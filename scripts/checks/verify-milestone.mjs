import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const EXIT = { pass: 0, violation: 1, error: 2 };
const COMMANDS = [
  'verify:pr',
  'check:docs',
  'check:adr',
  'check:api-compat',
  'test:contracts',
  'test:integration',
  'test:security',
  'test:smoke',
  'test:e2e',
  'check:regression-test',
];

function run(command) {
  const result = spawnSync('pnpm', [command], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status === 0) return EXIT.pass;
  if (result.status === 1 || result.status === 2) return result.status;
  throw new Error(`${command} exited unexpectedly with ${result.status}`);
}

function main() {
  if (process.env.TASK_ID === undefined || process.env.DIFF_BASE === undefined) {
    console.error('MILESTONE VERIFY ERROR: TASK_ID and DIFF_BASE must be explicit.');
    return EXIT.error;
  }
  const taskPath = resolve(process.cwd(), 'docs/tasks', `${process.env.TASK_ID}.yaml`);
  const task = parse(readFileSync(taskPath, 'utf8'));
  const commands = [...COMMANDS];
  if (task.database_change === true) {
    commands.push('test:migrations');
  } else {
    console.log('MILESTONE VERIFY: migration tests skipped because database_change=false.');
  }

  for (const command of commands) {
    const status = run(command);
    if (status !== EXIT.pass) return status;
  }
  console.log('PASS milestone verification: M1 gates completed.');
  return EXIT.pass;
}

try {
  process.exit(main());
} catch (error) {
  console.error(
    `CHECKER ERROR milestone verification: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(EXIT.error);
}
