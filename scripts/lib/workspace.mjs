import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parse } from 'yaml';

export const EXIT = { pass: 0, violation: 1, error: 2 };

export const DEFAULT_WORKSPACE_FILE = 'pnpm-workspace.yaml';

function childDirectories(parent) {
  if (!existsSync(parent)) {
    return [];
  }
  return readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => join(parent, entry.name))
    .sort();
}

export function expandWorkspacePattern(root, pattern) {
  const segments = pattern.split('/');
  let directories = [root];

  for (const segment of segments) {
    if (segment.includes('**')) {
      throw new Error(
        `Workspace pattern uses an unsupported recursive glob: ${pattern}. Use single-segment * patterns such as apps/*.`,
      );
    }
    if (segment === '*') {
      directories = directories.flatMap((parent) => childDirectories(parent));
    } else {
      directories = directories
        .map((parent) => join(parent, segment))
        .filter((path) => existsSync(path));
    }
  }

  return directories.filter((directory) => existsSync(directory));
}

export function readWorkspacePatterns(root, workspaceFile = DEFAULT_WORKSPACE_FILE) {
  const workspacePath = resolve(root, workspaceFile);
  if (!existsSync(workspacePath)) {
    throw new Error(`pnpm workspace configuration does not exist: ${workspacePath}`);
  }

  let document;
  try {
    document = parse(readFileSync(workspacePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot parse ${workspaceFile}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  const patterns = document?.packages ?? document?.workspaces;
  if (
    !Array.isArray(patterns) ||
    patterns.length === 0 ||
    patterns.some((pattern) => typeof pattern !== 'string' || pattern.length === 0)
  ) {
    throw new Error(`${workspaceFile} must define a non-empty packages array`);
  }
  return patterns;
}

function readPackageJson(packagePath) {
  try {
    return JSON.parse(readFileSync(packagePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot parse workspace package manifest ${packagePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}

function workspaceImporterKey(root, packageDirectory) {
  return relative(root, packageDirectory).replaceAll('\\', '/');
}

export function discoverWorkspacePackages(
  root = process.cwd(),
  workspaceFile = DEFAULT_WORKSPACE_FILE,
) {
  const absoluteRoot = resolve(root);
  const patterns = readWorkspacePatterns(absoluteRoot, workspaceFile);
  const directories = [
    ...new Set(patterns.flatMap((pattern) => expandWorkspacePattern(absoluteRoot, pattern))),
  ].sort();

  return directories.map((directory) => {
    const packagePath = join(directory, 'package.json');
    if (!existsSync(packagePath)) {
      throw new Error(
        `Workspace directory matched by pnpm-workspace.yaml has no package.json: ${relative(
          absoluteRoot,
          directory,
        )}`,
      );
    }
    const manifest = readPackageJson(packagePath);
    if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new Error(`Workspace package manifest must be an object: ${packagePath}`);
    }
    return {
      directory,
      importerKey: workspaceImporterKey(absoluteRoot, directory),
      manifest,
      name: typeof manifest.name === 'string' ? manifest.name : undefined,
      path: packagePath,
      scripts: manifest.scripts ?? {},
    };
  });
}
