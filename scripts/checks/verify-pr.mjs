import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };
const GATES = [
  'verify',
  'check:task-contract',
  'check:task-scope',
  'check:diff-size',
  'check:secrets',
  'check:dependencies',
];

export function runPrVerification({
  env = process.env,
  cwd = process.cwd(),
  runner = 'pnpm',
} = {}) {
  for (const gate of GATES) {
    const result = spawnSync(runner, [gate], {
      cwd,
      encoding: 'utf8',
      env: { ...env },
      stdio: 'inherit',
    });
    if (result.error) {
      console.error(`VERIFY_PR_ERROR: cannot run ${gate}: ${result.error.message}`);
      return EXIT.error;
    }
    if (result.signal !== null) {
      console.error(`VERIFY_PR_ERROR: ${gate} terminated by ${result.signal}`);
      return EXIT.error;
    }
    if (result.status !== 0) {
      if (result.status === 1 || result.status === 2) return result.status;
      console.error(`VERIFY_PR_ERROR: ${gate} returned unexpected exit ${result.status}`);
      return EXIT.error;
    }
  }
  return EXIT.pass;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(runPrVerification());
  } catch (error) {
    console.error(`VERIFY_PR_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT.error);
  }
}
