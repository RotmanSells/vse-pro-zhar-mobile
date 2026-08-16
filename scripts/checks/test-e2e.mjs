import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const EXIT = { pass: 0, violation: 1, error: 2 };
const FLOW = '.maestro/m1-health.yaml';

function main() {
  if (!existsSync(resolve(process.cwd(), FLOW))) {
    console.error(`E2E VIOLATION: missing ${FLOW}.`);
    return EXIT.violation;
  }
  if (process.env.API_BASE_URL === undefined || process.env.API_BASE_URL.length === 0) {
    console.error('E2E ERROR: API_BASE_URL must be explicit for the mobile test environment.');
    return EXIT.error;
  }

  const result = spawnSync('maestro', ['test', FLOW], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error !== undefined) {
    console.error(`E2E ERROR: Maestro is unavailable: ${result.error.message}`);
    return EXIT.error;
  }
  if (result.status === 0 || result.status === 1 || result.status === 2) return result.status;
  console.error(`E2E ERROR: Maestro exited unexpectedly with ${result.status}`);
  return EXIT.error;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`CHECKER ERROR E2E: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(EXIT.error);
}
