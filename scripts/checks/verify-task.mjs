import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve } from 'node:path';

import { discoverWorkspacePackages, EXIT } from '../lib/workspace.mjs';

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_EXTENSIONS = new Set(['.cjs', '.js', '.mjs', '.ts', '.tsx']);
const PRETTIER_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.js',
  '.json',
  '.mjs',
  '.md',
  '.scss',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const IGNORED_PATH_PARTS = new Set([
  '.expo',
  '.next',
  'android',
  'artifacts',
  'build',
  'coverage',
  'dist',
  'generated',
  'node_modules',
]);

function optionValue(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  if (value === undefined) throw new Error(`${name} requires a value`);
  return value;
}

function run(root, label, args) {
  console.log(`[verify:task] ${label}: pnpm ${args.join(' ')}`);
  const result = spawnSync('pnpm', args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error !== undefined) {
    console.error(`VERIFY_TASK_ERROR: ${label}: ${result.error.message}`);
    return EXIT.error;
  }
  if (result.signal !== null) {
    console.error(`VERIFY_TASK_ERROR: ${label} terminated by ${result.signal}`);
    return EXIT.error;
  }
  return result.status ?? EXIT.error;
}

function gitFiles(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      `Cannot read Git changes: ${result.stderr || result.error?.message || 'unknown error'}`,
    );
  }
  return result.stdout.split('\0').filter(Boolean);
}

function changedFiles(root, base) {
  const committedOrWorking = gitFiles(root, [
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    '-z',
    base,
  ]);
  const untracked = gitFiles(root, ['ls-files', '--others', '--exclude-standard', '-z']);
  return [...new Set([...committedOrWorking, ...untracked])].sort();
}

function isIgnored(path) {
  return path.split('/').some((part) => IGNORED_PATH_PARTS.has(part)) || path.endsWith('.DS_Store');
}

function isGeneratedDeclaration(path) {
  return path === 'apps/mobile/expo-env.d.ts';
}

function isSourceFile(path) {
  return SOURCE_EXTENSIONS.has(extname(path)) && !isIgnored(path) && !isGeneratedDeclaration(path);
}

function isPrettierFile(path) {
  return PRETTIER_EXTENSIONS.has(extname(path)) && !isIgnored(path);
}

function isTestFile(path) {
  return /(?:^|\/)(?:test|tests)(?:\/|$)|(?:\.test|\.spec)\.[^.]+$/u.test(path);
}

function packageForPath(path, packages) {
  return packages.find(
    (packageInfo) =>
      path === packageInfo.importerKey || path.startsWith(`${packageInfo.importerKey}/`),
  );
}

function packageHasSourceChanges(pathSet, packageInfo) {
  return [...pathSet].some(
    (path) => packageForPath(path, [packageInfo]) !== undefined && isSourceFile(path),
  );
}

function rootNeedsTypecheck(paths) {
  return paths.some(
    (path) =>
      path.startsWith('scripts/lib/') ||
      path.startsWith('tests/') ||
      path === 'tsconfig.json' ||
      path === 'tsconfig.build.json',
  );
}

function rootNeedsUnitTests(paths) {
  return paths.some((path) => path.startsWith('tests/') || path.startsWith('scripts/lib/'));
}

function integrationPackageNames(paths, packages) {
  const backendPaths = paths.filter(
    (path) =>
      path.startsWith('apps/api/migrations/') ||
      path.startsWith('apps/api/src/application/') ||
      path.startsWith('apps/api/src/infrastructure/') ||
      path.startsWith('apps/api/src/presentation/'),
  );
  if (backendPaths.length === 0) return [];
  return packages
    .filter((packageInfo) => packageInfo.importerKey === 'apps/api')
    .filter((packageInfo) => Object.hasOwn(packageInfo.scripts, 'test:integration'))
    .map((packageInfo) => packageInfo.importerKey);
}

export function planTaskVerification(
  paths,
  packages,
  { integration = false, root = SCRIPT_ROOT } = {},
) {
  const sourcePaths = paths.filter(isSourceFile);
  const prettierPaths = paths
    .filter(isPrettierFile)
    .filter((path) => existsSync(resolve(root, path)));
  const impactedPackages = packages.filter((packageInfo) =>
    packageHasSourceChanges(new Set(sourcePaths), packageInfo),
  );
  const rootPaths = sourcePaths.filter((path) => packageForPath(path, packages) === undefined);
  const commands = [];

  if (prettierPaths.length > 0)
    commands.push({ label: 'format', args: ['exec', 'prettier', '--check', ...prettierPaths] });
  if (sourcePaths.length > 0)
    commands.push({ label: 'lint', args: ['exec', 'eslint', ...sourcePaths] });
  if (rootNeedsTypecheck(rootPaths))
    commands.push({ label: 'root typecheck', args: ['typecheck:root'] });
  if (rootNeedsUnitTests(rootPaths))
    commands.push({ label: 'root unit tests', args: ['test:unit:root'] });

  for (const packageInfo of impactedPackages) {
    if (Object.hasOwn(packageInfo.scripts, 'typecheck')) {
      commands.push({
        label: `${packageInfo.importerKey} typecheck`,
        args: ['--dir', packageInfo.directory, 'run', 'typecheck'],
      });
    }
    if (Object.hasOwn(packageInfo.scripts, 'test:unit')) {
      commands.push({
        label: `${packageInfo.importerKey} unit tests`,
        args: ['--dir', packageInfo.directory, 'run', 'test:unit'],
      });
    }
  }

  if (sourcePaths.some(isTestFile)) {
    commands.push({ label: 'test hygiene', args: ['check:test-hygiene'] });
  }
  if (integration) {
    for (const packageName of integrationPackageNames(paths, packages)) {
      const packageInfo = packages.find((item) => item.importerKey === packageName);
      if (packageInfo !== undefined) {
        commands.push({
          label: `${packageName} integration tests`,
          args: ['--dir', packageInfo.directory, 'run', 'test:integration'],
        });
      }
    }
  }

  return { commands, impactedPackages, prettierPaths, sourcePaths };
}

function main() {
  const argv = process.argv.slice(2);
  const root = resolve(process.cwd(), optionValue(argv, '--root', '.'));
  const base = optionValue(argv, '--base', process.env.DIFF_BASE ?? 'HEAD');
  const integration = argv.includes('--integration');
  const paths = changedFiles(root, base);
  if (paths.length === 0) {
    console.log('PASS verify:task: no changed files to verify.');
    return EXIT.pass;
  }

  const packages = discoverWorkspacePackages(root);
  const plan = planTaskVerification(paths, packages, { integration, root });
  if (plan.commands.length === 0) {
    console.log('PASS verify:task: changed files require no executable checks.');
    return EXIT.pass;
  }

  for (const command of plan.commands) {
    const status = run(root, command.label, command.args);
    if (status !== EXIT.pass) return status;
  }
  console.log(
    `PASS verify:task: checked ${paths.length} changed file(s), ${plan.impactedPackages.length} package(s).`,
  );
  if (!integration) {
    console.log(
      'INFO verify:task: integration/E2E remain final gates; use --integration or the focused E2E command when needed.',
    );
  }
  return EXIT.pass;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`VERIFY_TASK_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT.error);
  }
}
