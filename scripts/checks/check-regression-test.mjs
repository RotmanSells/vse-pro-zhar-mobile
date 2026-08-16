import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const result = spawnSync(
  process.execPath,
  [resolve(process.cwd(), 'scripts/checks/test-hygiene.mjs'), ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
  },
);

if (result.error !== undefined) {
  console.error(`CHECKER ERROR regression test: ${result.error.message}`);
  process.exit(2);
}

if (result.status === 0) {
  console.log('PASS regression-test check: no focused or undocumented skipped tests.');
  process.exit(0);
}

if (result.status === 1 || result.status === 2) {
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status);
}

console.error(`CHECKER ERROR regression test: unexpected child exit ${result.status}`);
process.exit(2);
