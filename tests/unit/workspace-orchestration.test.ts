import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

interface WorkspaceFixturePackage {
  importer: string;
  scripts: Record<string, string>;
}

function writeFixtureFile(root: string, relativePath: string, content: string): void {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function createWorkspaceFixture(packages: WorkspaceFixturePackage[]): {
  bin: string;
  log: string;
  root: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'vpzh-010-workspace-unit-'));
  const bin = join(root, 'bin');
  const log = join(root, 'calls.log');
  mkdirSync(bin, { recursive: true });
  writeFixtureFile(root, 'pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - packages/*\n');
  for (const workspacePackage of packages) {
    writeFixtureFile(
      root,
      `${workspacePackage.importer}/package.json`,
      JSON.stringify({ name: workspacePackage.importer, scripts: workspacePackage.scripts }),
    );
  }
  writeFixtureFile(
    root,
    'bin/pnpm',
    `#!/bin/sh\nprintf '%s\\n' "$*" >> "\${WORKSPACE_UNIT_LOG}"\nif [ "\${WORKSPACE_UNIT_CHILD_EXIT:-0}" != "0" ]; then\n  printf '%s\\n' "NATIVE_CHILD_EXIT_\${WORKSPACE_UNIT_CHILD_EXIT}" >&2\nfi\nexit "\${WORKSPACE_UNIT_CHILD_EXIT:-0}"\n`,
  );
  chmodSync(join(bin, 'pnpm'), 0o755);
  return { bin, log, root };
}

describe('workspace package orchestration', () => {
  it('discovers every workspace pattern and runs package commands deterministically', () => {
    const fixture = createWorkspaceFixture([
      { importer: 'apps/api', scripts: { typecheck: 'tsc --noEmit' } },
      {
        importer: 'packages/contracts',
        scripts: { typecheck: 'tsc --project tsconfig.json --noEmit' },
      },
    ]);

    try {
      const result = spawnSync(
        process.execPath,
        ['scripts/checks/workspace-run.mjs', '--root', fixture.root, '--command', 'typecheck'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${fixture.bin}:${process.env.PATH}`,
            WORKSPACE_UNIT_CHILD_EXIT: '0',
            WORKSPACE_UNIT_LOG: fixture.log,
          },
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      const calls = readFileSync(fixture.log, 'utf8');
      expect(calls.indexOf('apps/api')).toBeGreaterThan(-1);
      expect(calls.indexOf('packages/contracts')).toBeGreaterThan(-1);
      expect(calls.indexOf('apps/api')).toBeLessThan(calls.indexOf('packages/contracts'));
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('fails explicitly when a required package script is missing', () => {
    const fixture = createWorkspaceFixture([
      { importer: 'apps/api', scripts: { typecheck: 'tsc --noEmit' } },
      { importer: 'packages/contracts', scripts: {} },
    ]);

    try {
      const result = spawnSync(
        process.execPath,
        ['scripts/checks/workspace-run.mjs', '--root', fixture.root, '--command', 'typecheck'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${fixture.bin}:${process.env.PATH}`,
            WORKSPACE_UNIT_CHILD_EXIT: '0',
            WORKSPACE_UNIT_LOG: fixture.log,
          },
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain('WORKSPACE_VIOLATION');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('propagates a native child exit 2 without reclassifying it as wrapper setup error', () => {
    const fixture = createWorkspaceFixture([
      {
        importer: 'apps/api',
        scripts: { typecheck: 'tsc --noEmit' },
      },
    ]);

    try {
      const result = spawnSync(
        process.execPath,
        ['scripts/checks/workspace-run.mjs', '--root', fixture.root, '--command', 'typecheck'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${fixture.bin}:${process.env.PATH}`,
            WORKSPACE_UNIT_CHILD_EXIT: '2',
            WORKSPACE_UNIT_LOG: fixture.log,
          },
        },
      );

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(2);
      expect(`${result.stdout}\n${result.stderr}`).toContain('NATIVE_CHILD_EXIT_2');
      expect(`${result.stdout}\n${result.stderr}`).not.toContain('WORKSPACE_ERROR');
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
