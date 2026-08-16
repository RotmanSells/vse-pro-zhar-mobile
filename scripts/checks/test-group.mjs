import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const EXIT = { pass: 0, violation: 1, error: 2 };
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const ALLOWED_GROUPS = new Set(['integration', 'contracts', 'security', 'smoke']);

function collectTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectTests(path);
    return entry.isFile() && TEST_FILE.test(entry.name) ? [path] : [];
  });
}

function main(argv) {
  const groupIndex = argv.indexOf('--group');
  const group = groupIndex === -1 ? undefined : argv[groupIndex + 1];
  if (group === undefined || !ALLOWED_GROUPS.has(group)) {
    throw new Error('--group must be one of integration, contracts, security or smoke');
  }

  const directory = resolve(process.cwd(), 'tests', group);
  if (!existsSync(directory)) {
    console.error(`TEST GROUP VIOLATION: missing tests/${group}/; M1 has no ${group} tests yet.`);
    return EXIT.violation;
  }
  const tests = collectTests(directory);
  if (tests.length === 0) {
    console.error(`TEST GROUP VIOLATION: tests/${group}/ contains no test files.`);
    return EXIT.violation;
  }

  const jest = resolve(process.cwd(), 'node_modules/.bin/jest');
  if (!existsSync(jest)) throw new Error('Jest is not installed; run pnpm install first');
  const result = spawnSync(jest, ['--config', 'jest.config.cjs', '--runInBand', ...tests], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error !== undefined) throw result.error;
  if (result.status === 0) return EXIT.pass;
  if (result.status === 1 || result.status === 2) return result.status;
  throw new Error(`Jest exited unexpectedly with ${result.status}`);
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (error) {
  console.error(
    `CHECKER ERROR test group: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(EXIT.error);
}
