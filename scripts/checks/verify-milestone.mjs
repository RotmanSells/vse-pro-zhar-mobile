import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };
const GATES = ['verify:pr', 'test:e2e'];

export function runMilestoneVerification({
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
      console.error(`VERIFY_MILESTONE_ERROR: cannot run ${gate}: ${result.error.message}`);
      return EXIT.error;
    }
    if (result.signal !== null) {
      console.error(`VERIFY_MILESTONE_ERROR: ${gate} terminated by ${result.signal}`);
      return EXIT.error;
    }
    if (result.status !== 0) {
      if (result.status === EXIT.violation || result.status === EXIT.error) return result.status;
      console.error(`VERIFY_MILESTONE_ERROR: ${gate} returned unexpected exit ${result.status}`);
      return EXIT.error;
    }
  }
  return EXIT.pass;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(runMilestoneVerification());
  } catch (error) {
    console.error(
      `VERIFY_MILESTONE_ERROR: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(EXIT.error);
  }
}
