import { spawnSync } from 'node:child_process';

describe('VPZH-001 task contract', () => {
  it('validates the current task manifest against its JSON Schema', () => {
    const result = spawnSync(process.execPath, ['scripts/checks/validate-task-manifest.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });
});
