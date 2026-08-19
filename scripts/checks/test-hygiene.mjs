import { parse } from '@babel/parser';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const TEST_CALLEES = new Set(['describe', 'test', 'it']);
const PROJECT_TEST_ROOTS = ['tests', 'apps', 'packages', 'src'];
const IGNORED_DIRECTORIES = new Set([
  '.expo',
  '.generated',
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'generated',
  'node_modules',
]);

function parseArguments(argv) {
  const rootIndex = argv.indexOf('--root');
  const targetIndex = argv.indexOf('--target');
  const root = resolve(process.cwd(), rootIndex === -1 ? '.' : (argv[rootIndex + 1] ?? ''));
  if (rootIndex !== -1 && argv[rootIndex + 1] === undefined) {
    throw new Error('--root requires a directory');
  }
  if (targetIndex !== -1 && argv[targetIndex + 1] === undefined) {
    throw new Error('--target requires a directory or test file');
  }

  return {
    targets:
      targetIndex === -1
        ? PROJECT_TEST_ROOTS.map((path) => resolve(root, path)).filter(existsSync)
        : [resolve(root, argv[targetIndex + 1])],
  };
}

async function collectTestFiles(target) {
  const targetStats = await stat(target);
  if (targetStats.isFile()) {
    return TEST_FILE.test(target) ? [target] : [];
  }

  const entries = await readdir(target, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(target, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          return [];
        }
        return collectTestFiles(entryPath);
      }

      return entry.isFile() && TEST_FILE.test(entry.name) ? [entryPath] : [];
    }),
  );

  return files.flat();
}

function memberCallName(callee) {
  if (callee.type !== 'MemberExpression' || callee.computed) {
    return undefined;
  }
  if (callee.object.type !== 'Identifier' || callee.property.type !== 'Identifier') {
    return undefined;
  }
  if (!TEST_CALLEES.has(callee.object.name)) {
    return undefined;
  }

  return `${callee.object.name}.${callee.property.name}`;
}

function hasSkipReasonAndTaskReference(node) {
  const [title] = node.arguments;
  if (title?.type !== 'StringLiteral') {
    return false;
  }

  const normalizedTitle = title.value
    .replace(/VPZH-\d+/gu, '')
    .replaceAll('[', '')
    .replaceAll(']', '')
    .replaceAll('(', '')
    .replaceAll(')', '')
    .replaceAll('-', '')
    .replaceAll(':', '')
    .trim();
  return /VPZH-\d+/u.test(title.value) && normalizedTitle.length > 0;
}

function findViolations(ast) {
  const violations = [];
  const visited = new Set();

  function visit(value) {
    if (value === null || typeof value !== 'object' || visited.has(value)) {
      return;
    }
    visited.add(value);

    if (value.type === 'CallExpression') {
      const name =
        value.callee.type === 'Identifier' ? value.callee.name : memberCallName(value.callee);
      if (name === 'fit' || name === 'fdescribe' || name?.endsWith('.only')) {
        violations.push({
          line: value.loc.start.line,
          message: `Focused test call ${name} is not allowed.`,
        });
      }
      if (name?.endsWith('.skip') && !hasSkipReasonAndTaskReference(value)) {
        violations.push({
          line: value.loc.start.line,
          message: 'Skipped test title must include a reason and a VPZH task reference.',
        });
      }
    }

    for (const child of Object.values(value)) {
      if (Array.isArray(child)) {
        for (const item of child) {
          visit(item);
        }
      } else {
        visit(child);
      }
    }
  }

  visit(ast);
  return violations;
}

async function checkFile(filePath) {
  const source = await readFile(filePath, 'utf8');
  const ast = parse(source, {
    sourceType: 'unambiguous',
    plugins: ['typescript', 'jsx'],
  });
  return findViolations(ast).map((violation) => ({
    ...violation,
    filePath: relative(process.cwd(), filePath),
  }));
}

async function main() {
  const { targets } = parseArguments(process.argv.slice(2));
  const collectedFiles = await Promise.all(targets.map(collectTestFiles));
  const files = collectedFiles.flat();
  const results = await Promise.all(files.map(checkFile));
  const violations = results.flat();

  if (violations.length === 0) {
    console.log(`PASS test hygiene: checked ${files.length} test file(s).`);
    return EXIT.pass;
  }

  for (const violation of violations) {
    console.error(`${violation.filePath}:${violation.line} ${violation.message}`);
  }
  return EXIT.violation;
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((error) => {
    console.error(
      `CHECKER ERROR test hygiene: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(EXIT.error);
  });
