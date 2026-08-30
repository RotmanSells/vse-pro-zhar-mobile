import { spawnSync } from 'node:child_process';

const BASE = 'db038ddad9a26689d29a77bf2fe2401bec0b0777';
const SCRIPT = 'scripts/checks/task-base.mjs';

function run(environment: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, TASK_ID: 'VPZH-036', ...environment },
  });
}

describe('task base guard', () => {
  it('accepts a task branch whose manifest and PR base match origin/main', () => {
    const result = run({ DIFF_BASE: BASE });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('PASS task base: VPZH-036');
  });

  it('rejects a stale PR diff base before implementation checks run', () => {
    const result = run({ DIFF_BASE: 'a'.repeat(40) });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('TASK BASE VIOLATION');
    expect(result.stderr).toContain('DIFF_BASE');
  });
});
