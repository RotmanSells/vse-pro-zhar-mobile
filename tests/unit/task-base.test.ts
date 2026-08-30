import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const SCRIPT = resolve(process.cwd(), 'scripts/checks/task-base.mjs');
const SCHEMA = resolve(process.cwd(), 'contracts/tasks/task.schema.json');

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function run(environment: NodeJS.ProcessEnv = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vpzh-task-base-test-'));
  try {
    mkdirSync(join(root, 'docs/tasks'), { recursive: true });
    writeFileSync(join(root, 'seed.txt'), 'fixture\n');
    git(root, ['init', '--quiet']);
    git(root, ['config', 'user.email', 'task-base-test@example.invalid']);
    git(root, ['config', 'user.name', 'Task Base Test']);
    git(root, ['add', 'seed.txt']);
    git(root, ['commit', '--quiet', '-m', 'seed']);
    const base = git(root, ['rev-parse', 'HEAD^{commit}']);
    const sourceManifest = readFileSync(
      join(dirname(SCRIPT), '../../docs/tasks/VPZH-036.yaml'),
      'utf8',
    );
    const manifest = sourceManifest.replace(/^base_commit: .*$/mu, `base_commit: ${base}`);
    writeFileSync(join(root, 'docs/tasks/VPZH-036.yaml'), manifest);
    git(root, ['add', 'docs/tasks/VPZH-036.yaml']);
    git(root, ['commit', '--quiet', '-m', 'task manifest']);
    git(root, ['branch', '--move', 'task/test']);
    git(root, ['update-ref', 'refs/remotes/origin/main', base]);

    return spawnSync(process.execPath, [SCRIPT, '--root', root, '--schema', SCHEMA], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TASK_ID: 'VPZH-036', DIFF_BASE: base, ...environment },
    });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

describe('task base guard', () => {
  it('accepts a task branch whose manifest and PR base match origin/main', () => {
    const result = run();
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
