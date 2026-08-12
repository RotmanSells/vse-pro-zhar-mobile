import { spawnSync } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };

function runChecker(script, args, environment = {}, cwd = process.cwd(), captureOutput = false) {
  const result = spawnSync(process.execPath, [resolve(process.cwd(), script), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  return captureOutput
    ? { status: result.status, stderr: result.stderr, stdout: result.stdout }
    : result.status;
}

function runCheckerWithOutput(script, args, environment = {}, cwd = process.cwd()) {
  return runChecker(script, args, environment, cwd, true);
}

const TASK_SCHEMA = 'contracts/tasks/task.schema.json';
const TASK_SCOPE_SCRIPT = 'scripts/checks/task-scope.mjs';
const DIFF_SIZE_SCRIPT = 'scripts/checks/diff-size.mjs';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function writeFixtureFile(root, relativePath, content) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function commitFixture(cwd, message) {
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', message]);
  return git(cwd, ['rev-parse', 'HEAD']);
}

function fixtureManifest() {
  return `id: VPZH-006
type: chore
title: Temporary fixture task
goal: Validate committed task policy behavior in an isolated repository.
scope:
  modules: [fixture]
  layers: [tooling]
  paths: [docs/tasks/VPZH-006.yaml, allowed/**]
  in: [Run deterministic checker fixture tests.]
  out: [Product code.]
acceptance_criteria: [The fixture checker returns the documented result.]
test_plan:
  unit: [Run checker harness cases.]
  integration: [Run temporary Git repository cases.]
  e2e: [No user-facing flow exists.]
verification:
  commands: [pnpm check:task-scope, pnpm check:diff-size]
  manual: [Inspect the isolated Git history.]
api_change: false
database_change: false
architecture_change: false
security_sensitive: false
docs_impact: false
e2e_required: false
regression_test_required: false
adr: null
status: in_progress
`;
}

function createGitFixture(initialFiles = {}) {
  const root = mkdtempSync(join(tmpdir(), 'vpzh-006-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'fixture@example.invalid']);
  git(root, ['config', 'user.name', 'Fixture Runner']);
  writeFixtureFile(root, 'docs/tasks/VPZH-006.yaml', fixtureManifest());
  for (const [path, content] of Object.entries(initialFiles)) {
    writeFixtureFile(root, path, content);
  }
  const base = commitFixture(root, 'base fixture');
  return { base, root };
}

function applyFixtureChanges(fixture, changes) {
  for (const [path, content] of Object.entries(changes)) {
    const absolutePath = join(fixture.root, path);
    if (content === null) {
      rmSync(absolutePath);
    } else {
      writeFixtureFile(fixture.root, path, content);
    }
  }
  commitFixture(fixture.root, 'head fixture');
}

function checkerArgs(root) {
  return ['--root', root, '--schema', TASK_SCHEMA];
}

function withFixture(initialFiles, changes, callback) {
  const fixture = createGitFixture(initialFiles);
  try {
    applyFixtureChanges(fixture, changes);
    return callback(fixture);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
}

function assertStatus(actual, expected, name) {
  if (actual !== expected) {
    throw new Error(`${name}: expected exit ${expected}, received ${actual}`);
  }
}

function assertOutput(result, marker, name) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (!output.includes(marker)) {
    throw new Error(`${name}: expected output marker ${marker}`);
  }
}

function assertOutputIncludes(result, text, name) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (!output.includes(text)) {
    throw new Error(`${name}: expected output to include ${text}`);
  }
}

function runTaskScopeFixtureCases() {
  withFixture(
    {},
    {
      'docs/tasks/VPZH-006.yaml': fixtureManifest().replace(
        'status: in_progress',
        'status: completed',
      ),
    },
    (fixture) => {
      const result = runCheckerWithOutput(TASK_SCOPE_SCRIPT, checkerArgs(fixture.root), {
        DIFF_BASE: fixture.base,
        TASK_ID: 'VPZH-006',
      });
      assertStatus(result.status, EXIT.pass, 'task scope exact path pass');
    },
  );
  withFixture({}, { 'allowed/exact.txt': 'ok\n', 'allowed/nested/file.txt': 'ok\n' }, (fixture) => {
    assertStatus(
      runChecker(TASK_SCOPE_SCRIPT, checkerArgs(fixture.root), {
        DIFF_BASE: fixture.base,
        TASK_ID: 'VPZH-006',
      }),
      EXIT.pass,
      'task scope exact/glob pass',
    );
  });
  withFixture({}, { 'outside.txt': 'violation\n' }, (fixture) => {
    const result = runCheckerWithOutput(TASK_SCOPE_SCRIPT, checkerArgs(fixture.root), {
      DIFF_BASE: fixture.base,
      TASK_ID: 'VPZH-006',
    });
    assertStatus(result.status, EXIT.violation, 'task scope out-of-scope violation');
    assertOutput(result, 'TASK_SCOPE_VIOLATION', 'task scope out-of-scope marker');
  });
  withFixture(
    { 'outside-delete.txt': 'delete me\n' },
    { 'outside-delete.txt': null },
    (fixture) => {
      const result = runCheckerWithOutput(TASK_SCOPE_SCRIPT, checkerArgs(fixture.root), {
        DIFF_BASE: fixture.base,
        TASK_ID: 'VPZH-006',
      });
      assertStatus(result.status, EXIT.violation, 'task scope deletion violation');
      assertOutput(result, 'TASK_SCOPE_VIOLATION', 'task scope deletion marker');
    },
  );
  const renameFixture = createGitFixture({ 'outside-rename.txt': 'rename me\n' });
  try {
    mkdirSync(join(renameFixture.root, 'allowed'), { recursive: true });
    git(renameFixture.root, ['mv', 'outside-rename.txt', 'allowed/renamed.txt']);
    commitFixture(renameFixture.root, 'rename fixture');
    const result = runCheckerWithOutput(TASK_SCOPE_SCRIPT, checkerArgs(renameFixture.root), {
      DIFF_BASE: renameFixture.base,
      TASK_ID: 'VPZH-006',
    });
    assertStatus(result.status, EXIT.violation, 'task scope rename source violation');
    assertOutput(result, 'TASK_SCOPE_VIOLATION', 'task scope rename marker');
  } finally {
    rmSync(renameFixture.root, { force: true, recursive: true });
  }
  const copyFixture = createGitFixture({ 'outside-copy.txt': 'copy me\n' });
  try {
    mkdirSync(join(copyFixture.root, 'allowed'), { recursive: true });
    writeFixtureFile(copyFixture.root, 'allowed/copied.txt', 'copy me\n');
    commitFixture(copyFixture.root, 'copy fixture');
    const result = runCheckerWithOutput(TASK_SCOPE_SCRIPT, checkerArgs(copyFixture.root), {
      DIFF_BASE: copyFixture.base,
      TASK_ID: 'VPZH-006',
    });
    assertStatus(result.status, EXIT.violation, 'task scope copy source violation');
    assertOutput(result, 'TASK_SCOPE_VIOLATION', 'task scope copy marker');
  } finally {
    rmSync(copyFixture.root, { force: true, recursive: true });
  }
  withFixture({}, { 'allowed/one.txt': 'ok\n', 'outside-two.txt': 'violation\n' }, (fixture) => {
    const result = runCheckerWithOutput(TASK_SCOPE_SCRIPT, checkerArgs(fixture.root), {
      DIFF_BASE: fixture.base,
      TASK_ID: 'VPZH-006',
    });
    assertStatus(result.status, EXIT.violation, 'task scope multiple paths violation');
    assertOutput(result, 'TASK_SCOPE_VIOLATION', 'task scope multiple paths marker');
  });
  withFixture({}, { 'allowed/base.txt': 'ok\n' }, (fixture) => {
    assertStatus(
      runChecker(TASK_SCOPE_SCRIPT, checkerArgs(fixture.root), { TASK_ID: 'VPZH-006' }),
      EXIT.error,
      'task scope missing DIFF_BASE error',
    );
    assertStatus(
      runChecker(TASK_SCOPE_SCRIPT, checkerArgs(fixture.root), {
        DIFF_BASE: 'does-not-exist',
        TASK_ID: 'VPZH-006',
      }),
      EXIT.error,
      'task scope invalid DIFF_BASE error',
    );
  });
  withFixture({}, { 'docs/tasks/VPZH-006.yaml': 'id: VPZH-006\n' }, (fixture) => {
    assertStatus(
      runChecker(TASK_SCOPE_SCRIPT, checkerArgs(fixture.root), {
        DIFF_BASE: fixture.base,
        TASK_ID: 'VPZH-006',
      }),
      EXIT.error,
      'task scope invalid task prerequisite error',
    );
  });
}

function runDiffSizeFixtureCases() {
  const lineFile = (count) => `${'line\n'.repeat(count)}`;
  const runCount = (count, expected, name) => {
    withFixture({}, { 'allowed/meaningful.ts': lineFile(count) }, (fixture) => {
      const result = runCheckerWithOutput(DIFF_SIZE_SCRIPT, checkerArgs(fixture.root), {
        DIFF_BASE: fixture.base,
        TASK_ID: 'VPZH-006',
      });
      assertStatus(result.status, expected, name);
      if (count > 1200 && count <= 2500) {
        assertOutput(result, 'DIFF_SIZE_REVIEW_WARNING', `${name} warning marker`);
      }
      if (count > 2500 && count <= 3000) {
        assertOutput(result, 'DIFF_SIZE_STRONG_WARNING', `${name} warning marker`);
      }
    });
  };
  runCount(100, EXIT.pass, 'diff size small pass');
  runCount(1201, EXIT.pass, 'diff size review warning pass');
  runCount(2501, EXIT.pass, 'diff size strong warning pass');
  runCount(3000, EXIT.pass, 'diff size hard boundary pass');
  const hardFixture = createGitFixture();
  try {
    applyFixtureChanges(hardFixture, { 'allowed/meaningful.ts': lineFile(3001) });
    const result = runCheckerWithOutput(DIFF_SIZE_SCRIPT, checkerArgs(hardFixture.root), {
      DIFF_BASE: hardFixture.base,
      TASK_ID: 'VPZH-006',
    });
    assertStatus(result.status, EXIT.violation, 'diff size hard violation');
    assertOutput(result, 'DIFF_SIZE_VIOLATION', 'diff size hard marker');
  } finally {
    rmSync(hardFixture.root, { force: true, recursive: true });
  }
  withFixture(
    {},
    {
      'allowed/meaningful.ts': lineFile(3001),
      'dist/generated.js': lineFile(4000),
      'pnpm-lock.yaml': lineFile(4000),
      'allowed/__snapshots__/fixture.snap': lineFile(4000),
    },
    (fixture) => {
      const result = runCheckerWithOutput(DIFF_SIZE_SCRIPT, checkerArgs(fixture.root), {
        DIFF_BASE: fixture.base,
        TASK_ID: 'VPZH-006',
      });
      assertStatus(
        result.status,
        EXIT.violation,
        'diff size noise cannot hide meaningful violation',
      );
      assertOutput(result, 'DIFF_SIZE_VIOLATION', 'diff size noise hard marker');
      assertOutputIncludes(result, 'meaningful=3001', 'diff size noise meaningful count');
      assertOutputIncludes(result, 'generated=4000', 'diff size generated count');
      assertOutputIncludes(result, 'lockfile=4000', 'diff size lockfile count');
      assertOutputIncludes(result, 'snapshot=4000', 'diff size snapshot count');
    },
  );
  withFixture(
    {},
    {
      'allowed/small.ts': lineFile(2),
      'dist/generated.js': lineFile(4000),
      'pnpm-lock.yaml': lineFile(4000),
      'allowed/__snapshots__/fixture.snap': lineFile(4000),
    },
    (fixture) => {
      const result = runCheckerWithOutput(DIFF_SIZE_SCRIPT, checkerArgs(fixture.root), {
        DIFF_BASE: fixture.base,
        TASK_ID: 'VPZH-006',
      });
      assertStatus(result.status, EXIT.pass, 'diff size noise-only pass');
      assertOutputIncludes(result, 'meaningful=2', 'diff size noise-only meaningful count');
      assertOutputIncludes(result, 'generated=4000', 'diff size noise-only generated count');
      assertOutputIncludes(result, 'lockfile=4000', 'diff size noise-only lockfile count');
      assertOutputIncludes(result, 'snapshot=4000', 'diff size noise-only snapshot count');
    },
  );
  withFixture({}, { 'allowed/binary.bin': Buffer.from([0, 1, 2, 3]) }, (fixture) => {
    assertStatus(
      runChecker(DIFF_SIZE_SCRIPT, checkerArgs(fixture.root), {
        DIFF_BASE: fixture.base,
        TASK_ID: 'VPZH-006',
      }),
      EXIT.pass,
      'diff size binary separate category',
    );
  });
  withFixture({}, { 'allowed/small.ts': 'ok\n' }, (fixture) => {
    assertStatus(
      runChecker(DIFF_SIZE_SCRIPT, checkerArgs(fixture.root), { TASK_ID: 'VPZH-006' }),
      EXIT.error,
      'diff size missing DIFF_BASE error',
    );
    assertStatus(
      runChecker(DIFF_SIZE_SCRIPT, checkerArgs(fixture.root), {
        DIFF_BASE: 'does-not-exist',
        TASK_ID: 'VPZH-006',
      }),
      EXIT.error,
      'diff size invalid DIFF_BASE error',
    );
  });
  withFixture({}, { 'docs/tasks/VPZH-006.yaml': 'id: VPZH-006\n' }, (fixture) => {
    assertStatus(
      runChecker(DIFF_SIZE_SCRIPT, checkerArgs(fixture.root), {
        DIFF_BASE: fixture.base,
        TASK_ID: 'VPZH-006',
      }),
      EXIT.error,
      'diff size invalid task prerequisite error',
    );
  });
}

function main() {
  const cases = [
    {
      name: 'test hygiene pass',
      script: 'scripts/checks/test-hygiene.mjs',
      args: [],
      expected: EXIT.pass,
    },
    {
      name: 'test hygiene violation',
      script: 'scripts/checks/test-hygiene.mjs',
      args: ['--target', 'scripts/checks/fixtures/test-hygiene/focused.test.ts'],
      expected: EXIT.violation,
    },
    {
      name: 'test hygiene application-location violation',
      script: 'scripts/checks/test-hygiene.mjs',
      args: ['--root', 'scripts/checks/fixtures/test-hygiene/project-locations'],
      expected: EXIT.violation,
    },
    {
      name: 'test hygiene configuration error',
      script: 'scripts/checks/test-hygiene.mjs',
      args: ['--target', 'scripts/checks/fixtures/test-hygiene/malformed.test.ts'],
      expected: EXIT.error,
    },
    {
      name: 'architecture pass',
      script: 'scripts/checks/architecture.mjs',
      args: ['--target', 'scripts/checks/fixtures/architecture/allowed'],
      expected: EXIT.pass,
    },
    {
      name: 'architecture violation',
      script: 'scripts/checks/architecture.mjs',
      args: ['--target', 'scripts/checks/fixtures/architecture/forbidden'],
      expected: EXIT.violation,
    },
    {
      name: 'architecture restricted npm dependency violation',
      script: 'scripts/checks/architecture.mjs',
      args: ['--target', 'scripts/checks/fixtures/architecture/forbidden-npm'],
      expected: EXIT.violation,
    },
    {
      name: 'architecture configuration error',
      script: 'scripts/checks/architecture.mjs',
      args: ['--target', 'scripts/checks/fixtures/architecture/allowed', '--config', 'missing.cjs'],
      expected: EXIT.error,
    },
    {
      name: 'automation synchronization pass',
      script: 'scripts/checks/automation-sync.mjs',
      args: [],
      expected: EXIT.pass,
    },
    {
      name: 'automation synchronization violation',
      script: 'scripts/checks/automation-sync.mjs',
      args: ['--registry', 'scripts/checks/fixtures/automation-sync/mismatch-registry.json'],
      expected: EXIT.violation,
    },
    {
      name: 'automation synchronization script implementation violation',
      script: 'scripts/checks/automation-sync.mjs',
      args: ['--root', 'scripts/checks/fixtures/automation-sync/script-mismatch'],
      expected: EXIT.violation,
    },
    {
      name: 'automation synchronization configuration error',
      script: 'scripts/checks/automation-sync.mjs',
      args: ['--registry', 'scripts/checks/fixtures/automation-sync/malformed-registry.json'],
      expected: EXIT.error,
    },
    {
      name: 'task contract deterministic explicit selection pass',
      script: 'scripts/checks/task-contract.mjs',
      args: [
        '--root',
        'scripts/checks/fixtures/task-contract/multiple-manifests',
        '--schema',
        'contracts/tasks/task.schema.json',
      ],
      environment: { TASK_ID: 'VPZH-901' },
      expected: EXIT.pass,
    },
    {
      name: 'task contract missing TASK_ID configuration error',
      script: 'scripts/checks/task-contract.mjs',
      args: [],
      environment: { TASK_ID: '' },
      expected: EXIT.error,
    },
    {
      name: 'task contract malformed TASK_ID configuration error',
      script: 'scripts/checks/task-contract.mjs',
      args: [],
      environment: { TASK_ID: 'VPZH-5' },
      expected: EXIT.error,
    },
    {
      name: 'task contract missing selected manifest violation',
      script: 'scripts/checks/task-contract.mjs',
      args: [
        '--root',
        'scripts/checks/fixtures/task-contract/multiple-manifests',
        '--schema',
        'contracts/tasks/task.schema.json',
      ],
      environment: { TASK_ID: 'VPZH-999' },
      expected: EXIT.violation,
    },
    {
      name: 'task contract schema-invalid manifest violation',
      script: 'scripts/checks/task-contract.mjs',
      args: [
        '--root',
        'scripts/checks/fixtures/task-contract/schema-invalid',
        '--schema',
        'contracts/tasks/task.schema.json',
      ],
      environment: { TASK_ID: 'VPZH-910' },
      expected: EXIT.violation,
    },
    {
      name: 'task contract mismatched manifest id violation',
      script: 'scripts/checks/task-contract.mjs',
      args: [
        '--root',
        'scripts/checks/fixtures/task-contract/id-mismatch',
        '--schema',
        'contracts/tasks/task.schema.json',
      ],
      environment: { TASK_ID: 'VPZH-911' },
      expected: EXIT.violation,
    },
    {
      name: 'task contract missing own manifest scope violation',
      script: 'scripts/checks/task-contract.mjs',
      args: [
        '--root',
        'scripts/checks/fixtures/task-contract/missing-own-scope',
        '--schema',
        'contracts/tasks/task.schema.json',
      ],
      environment: { TASK_ID: 'VPZH-912' },
      expected: EXIT.violation,
    },
    {
      name: 'task contract broken schema configuration error',
      script: 'scripts/checks/task-contract.mjs',
      args: [
        '--root',
        'scripts/checks/fixtures/task-contract/multiple-manifests',
        '--schema',
        'scripts/checks/fixtures/task-contract/broken-schema.json',
      ],
      environment: { TASK_ID: 'VPZH-901' },
      expected: EXIT.error,
    },
  ];
  const failures = [];
  for (const testCase of cases) {
    const actual = runChecker(testCase.script, testCase.args, testCase.environment);
    if (actual !== testCase.expected) {
      failures.push(`${testCase.name}: expected exit ${testCase.expected}, received ${actual}`);
    }
  }
  runTaskScopeFixtureCases();
  runDiffSizeFixtureCases();

  if (failures.length === 0) {
    console.log(
      `PASS checker exit-code contract: ${cases.length} direct cases and isolated Git fixture cases verified.`,
    );
    return EXIT.pass;
  }
  for (const failure of failures) {
    console.error(`CHECKER EXIT-CODE VIOLATION: ${failure}`);
  }
  return EXIT.violation;
}

try {
  process.exit(main());
} catch (error) {
  console.error(
    `CHECKER ERROR exit-code harness: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(EXIT.error);
}
