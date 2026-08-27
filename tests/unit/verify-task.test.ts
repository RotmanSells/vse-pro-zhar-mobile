import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

function writeFixtureFile(root: string, relativePath: string, content: string): void {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function createFixture(): { bin: string; log: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'vpzh-task-verify-unit-'));
  const bin = join(root, 'bin');
  const log = join(root, 'calls.log');
  mkdirSync(bin, { recursive: true });
  writeFixtureFile(root, 'pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - packages/*\n');
  for (const importer of ['apps/admin', 'apps/api', 'apps/mobile', 'packages/contracts']) {
    writeFixtureFile(
      root,
      `${importer}/package.json`,
      JSON.stringify({
        name: importer,
        scripts: { 'test:unit': 'true', test: 'true', typecheck: 'true' },
      }),
    );
  }
  writeFixtureFile(root, 'apps/api/src/application/product.ts', 'export const product = true;\n');
  writeFixtureFile(root, 'apps/mobile/test/product.test.ts', 'export const productTest = true;\n');
  writeFixtureFile(
    root,
    'bin/pnpm',
    '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$VERIFY_TASK_UNIT_LOG"\nexit 0\n',
  );
  chmodSync(join(bin, 'pnpm'), 0o755);

  spawnSync('git', ['init', '--quiet'], { cwd: root });
  spawnSync('git', ['config', 'user.email', 'verify-task@example.test'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'verify-task'], { cwd: root });
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: root });
  writeFixtureFile(root, 'apps/api/src/application/product.ts', 'export const product = false;\n');
  writeFixtureFile(root, 'apps/mobile/test/product.test.ts', 'export const productTest = false;\n');
  return { bin, log, root };
}

describe('verify:task changed-package selection', () => {
  it('checks only impacted packages and does not invoke the full verify chain', () => {
    const fixture = createFixture();

    try {
      const result = spawnSync(
        process.execPath,
        ['scripts/checks/verify-task.mjs', '--root', fixture.root],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${fixture.bin}:${process.env.PATH}`,
            VERIFY_TASK_UNIT_LOG: fixture.log,
          },
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      const calls = readFileSync(fixture.log, 'utf8');
      expect(calls).toContain('exec prettier --check');
      expect(calls).toContain('exec eslint');
      expect(calls).toContain(`${fixture.root}/apps/api run typecheck`);
      expect(calls).toContain(`${fixture.root}/apps/api run test:unit`);
      expect(calls).toContain(`${fixture.root}/apps/mobile run typecheck`);
      expect(calls).toContain(`${fixture.root}/apps/mobile run test:unit`);
      expect(calls).toContain('check:test-hygiene');
      expect(calls).not.toContain(`${fixture.root}/apps/admin`);
      expect(calls).not.toContain(`${fixture.root}/packages/contracts`);
      expect(calls).not.toContain(' verify ');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
