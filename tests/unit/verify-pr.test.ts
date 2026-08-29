import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

function runGit(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function writeFixtureFile(root: string, relativePath: string, content: string): void {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function createFixture(changedPath: string): {
  base: string;
  bin: string;
  log: string;
  root: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'vpzh-verify-pr-unit-'));
  const bin = join(root, 'bin');
  const log = join(root, 'calls.log');
  mkdirSync(bin, { recursive: true });
  writeFixtureFile(root, 'base.txt', 'base\n');
  writeFixtureFile(root, 'pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - packages/*\n');
  for (const importer of ['apps/admin', 'apps/api', 'apps/mobile', 'packages/contracts']) {
    const dependencies =
      importer === 'apps/api' || importer === 'apps/mobile'
        ? { '@fixture/contracts': 'workspace:*' }
        : undefined;
    writeFixtureFile(
      root,
      `${importer}/package.json`,
      JSON.stringify({
        ...(dependencies === undefined ? {} : { dependencies }),
        name: importer === 'packages/contracts' ? '@fixture/contracts' : importer,
        scripts: { 'test:unit': 'true', typecheck: 'true', 'test:integration': 'true' },
      }),
    );
  }
  writeFixtureFile(
    root,
    'bin/pnpm',
    '#!/bin/sh\nprintf \'%s\\n\' "$1" >> "$VERIFY_PR_UNIT_LOG"\nexit 0\n',
  );
  chmodSync(join(bin, 'pnpm'), 0o755);

  runGit(root, ['init', '--quiet']);
  runGit(root, ['config', 'user.email', 'verify-pr@example.test']);
  runGit(root, ['config', 'user.name', 'verify-pr']);
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '--quiet', '-m', 'base']);
  const base = runGit(root, ['rev-parse', 'HEAD']);
  writeFixtureFile(root, changedPath, 'changed\n');
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '--quiet', '-m', 'change']);
  return { base, bin, log, root };
}

describe('verify:pr verification mode', () => {
  it.each([
    ['docs/notes.md', 'verify:task'],
    ['apps/mobile/src/example.ts', 'verify:task'],
  ])('selects %s for %s changes', (changedPath, expectedFirstGate) => {
    const fixture = createFixture(changedPath);

    try {
      const result = spawnSync(
        process.execPath,
        [resolve(process.cwd(), 'scripts/checks/verify-pr.mjs')],
        {
          cwd: fixture.root,
          encoding: 'utf8',
          env: {
            ...process.env,
            DIFF_BASE: fixture.base,
            PATH: `${fixture.bin}:${process.env.PATH}`,
            VERIFY_PR_UNIT_LOG: fixture.log,
          },
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(readFileSync(fixture.log, 'utf8').split('\n')[0]).toBe(expectedFirstGate);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  it('plans only the impacted package and integration boundary', () => {
    const fixture = createFixture('apps/mobile/src/example.ts');

    try {
      const result = spawnSync(
        process.execPath,
        [resolve(process.cwd(), 'scripts/checks/verify-pr.mjs'), '--plan'],
        {
          cwd: fixture.root,
          encoding: 'utf8',
          env: { ...process.env, DIFF_BASE: fixture.base },
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout.trim())).toEqual({
        changedPaths: ['apps/mobile/src/example.ts'],
        impactedPackages: ['apps/mobile'],
        integrationPackages: [],
        mode: 'incremental',
      });
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  it('plans API and Mobile dependents when shared contracts change', () => {
    const fixture = createFixture('packages/contracts/src/product.ts');

    try {
      const result = spawnSync(
        process.execPath,
        [resolve(process.cwd(), 'scripts/checks/verify-pr.mjs'), '--plan'],
        {
          cwd: fixture.root,
          encoding: 'utf8',
          env: { ...process.env, DIFF_BASE: fixture.base },
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout.trim())).toEqual({
        changedPaths: ['packages/contracts/src/product.ts'],
        impactedPackages: ['apps/api', 'apps/mobile', 'packages/contracts'],
        integrationPackages: ['api'],
        mode: 'incremental',
      });
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });
});
