import { spawnSync } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };

function runChecker(script, args, environment = {}, cwd = process.cwd(), captureOutput = false) {
  const result = spawnSync(process.execPath, [resolve(process.cwd(), script), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, TASK_ID: undefined, DIFF_BASE: undefined, ...environment },
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
const SECRETS_SCRIPT = 'scripts/checks/secrets.mjs';
const DEPENDENCIES_SCRIPT = 'scripts/checks/dependencies.mjs';
const VERIFY_PR_SCRIPT = 'scripts/checks/verify-pr.mjs';
const PR_TASK_ID_SCRIPT = 'scripts/checks/pr-task-id.mjs';
const GATES = [
  'verify',
  'check:task-contract',
  'check:task-scope',
  'check:diff-size',
  'check:secrets',
  'check:dependencies',
];

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch (error) {
    const detail = error?.stderr === undefined ? '' : `: ${String(error.stderr).trim()}`;
    throw new Error(`git ${args.join(' ')} failed${detail}`, { cause: error });
  }
}

function writeFixtureFile(root, relativePath, content) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function commitFixture(cwd, message) {
  git(cwd, ['add', '-A', '-f', '.']);
  try {
    git(cwd, ['commit', '--allow-empty', '-m', message]);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)} (fixture=${cwd})`, {
      cause: error,
    });
  }
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

function createSecretFixture() {
  const root = mkdtempSync(join(tmpdir(), 'vpzh-007-secrets-'));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'fixture@example.invalid']);
  git(root, ['config', 'user.name', 'Fixture Runner']);
  writeFixtureFile(root, 'clean.txt', 'nothing sensitive here\n');
  const base = commitFixture(root, 'base fixture');
  return { base, root };
}

function runSecretFixture(changes, expected, name, assertValue = undefined) {
  const fixture = createSecretFixture();
  try {
    applyFixtureChanges(fixture, changes);
    const result = runCheckerWithOutput(SECRETS_SCRIPT, ['--root', fixture.root], {
      DIFF_BASE: fixture.base,
    });
    assertStatus(result.status, expected, name);
    if (assertValue !== undefined && `${result.stdout}\n${result.stderr}`.includes(assertValue)) {
      throw new Error(`${name}: secret value was printed`);
    }
    return result;
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
}

function fakePnpmDirectory(report, exitCode = 0) {
  const root = mkdtempSync(join(tmpdir(), 'vpzh-007-pnpm-'));
  const script = `#!/bin/sh\nprintf '%s' '${report.replaceAll("'", "'\\''")}'\nexit ${exitCode}\n`;
  writeFileSync(join(root, 'pnpm'), script);
  chmodSync(join(root, 'pnpm'), 0o755);
  return root;
}

function dependencyFixture() {
  const root = mkdtempSync(join(tmpdir(), 'vpzh-007-deps-'));
  writeFixtureFile(
    root,
    'package.json',
    JSON.stringify(
      {
        packageManager: 'pnpm@11.7.0',
        engines: { pnpm: '11.7.0' },
        dependencies: { fixture: '1.2.3' },
      },
      null,
      2,
    ),
  );
  writeFixtureFile(
    root,
    'pnpm-lock.yaml',
    `lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      fixture:\n        specifier: 1.2.3\n        version: 1.2.3\n`,
  );
  return root;
}

function runDependencyFixture(report, expected, name, auditExit = 0) {
  const root = dependencyFixture();
  const fake = fakePnpmDirectory(report, auditExit);
  try {
    const result = runCheckerWithOutput(DEPENDENCIES_SCRIPT, ['--root', root], {
      PATH: `${fake}:${process.env.PATH}`,
    });
    assertStatus(result.status, expected, name);
    return result;
  } finally {
    rmSync(root, { force: true, recursive: true });
    rmSync(fake, { force: true, recursive: true });
  }
}

function runDependencyConfigFixture(mutate, expected, name) {
  const root = dependencyFixture();
  const fake = fakePnpmDirectory(
    JSON.stringify({
      metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 } },
    }),
  );
  try {
    mutate(root);
    const beforePackage = readFileSync(join(root, 'package.json'), 'utf8');
    const beforeLock = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
    const result = runCheckerWithOutput(DEPENDENCIES_SCRIPT, ['--root', root], {
      PATH: `${fake}:${process.env.PATH}`,
    });
    assertStatus(result.status, expected, name);
    if (expected === EXIT.violation) assertOutput(result, 'DEPENDENCY_VIOLATION', `${name} marker`);
    if (
      readFileSync(join(root, 'package.json'), 'utf8') !== beforePackage ||
      readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8') !== beforeLock
    ) {
      throw new Error(`${name}: checker modified dependency files`);
    }
  } finally {
    rmSync(root, { force: true, recursive: true });
    rmSync(fake, { force: true, recursive: true });
  }
}

function runNewCheckerFixtureCases() {
  for (const [title, expected] of [
    ['VPZH-008 Wire deterministic PR verification', 'VPZH-008'],
    ['VPZH-123 Something', 'VPZH-123'],
  ]) {
    const result = runCheckerWithOutput(PR_TASK_ID_SCRIPT, ['--title', title]);
    assertStatus(result.status, EXIT.pass, `PR title task identity pass (${title})`);
    if (result.stdout.trim() !== expected)
      throw new Error(`PR title task identity output mismatch for ${title}`);
  }
  for (const title of [
    '',
    'Something',
    'vpzh-008 Lowercase',
    'VPZH-008x malformed',
    ' VPZH-008 Leading whitespace',
  ]) {
    const result = runCheckerWithOutput(PR_TASK_ID_SCRIPT, ['--title', title]);
    assertStatus(result.status, EXIT.error, `PR title task identity error (${title || 'empty'})`);
    assertOutput(result, 'PR_TASK_ID_ERROR', `PR title task identity marker (${title || 'empty'})`);
  }
  const orchestrationRoot = mkdtempSync(join(tmpdir(), 'vpzh-008-verify-pr-'));
  const fakePnpm = join(orchestrationRoot, 'pnpm');
  const logPath = join(orchestrationRoot, 'calls.log');
  const fakeScript = `#!/bin/sh
printf '%s\\n' "$1" >> "${logPath}"
case "$1" in
  check:task-contract) exit "\${VPZH_VERIFY_PR_UNEXPECTED_EXIT:-0}" ;;
  check:task-scope) exit "\${VPZH_VERIFY_PR_SCOPE_EXIT:-0}" ;;
  check:diff-size) exit "\${VPZH_VERIFY_PR_DIFF_EXIT:-0}" ;;
  *) exit 0 ;;
esac
`;
  writeFileSync(fakePnpm, fakeScript);
  chmodSync(fakePnpm, 0o755);
  try {
    const pass = runCheckerWithOutput(VERIFY_PR_SCRIPT, [], {
      PATH: orchestrationRoot,
      VPZH_VERIFY_PR_SCOPE_EXIT: '0',
      VPZH_VERIFY_PR_DIFF_EXIT: '0',
    });
    assertStatus(pass.status, EXIT.pass, 'verify:pr orchestration pass');
    const expectedCalls = GATES.join('\n');
    if (readFileSync(logPath, 'utf8').trim() !== expectedCalls)
      throw new Error('verify:pr did not invoke gates in the documented order');
    writeFileSync(logPath, '');
    const scopeFail = runCheckerWithOutput(VERIFY_PR_SCRIPT, [], {
      PATH: orchestrationRoot,
      VPZH_VERIFY_PR_SCOPE_EXIT: '1',
      VPZH_VERIFY_PR_DIFF_EXIT: '0',
    });
    assertStatus(scopeFail.status, EXIT.violation, 'verify:pr short-circuit violation');
    if (readFileSync(logPath, 'utf8').trim() !== 'verify\ncheck:task-contract\ncheck:task-scope')
      throw new Error('verify:pr launched gates after a policy violation');
    writeFileSync(logPath, '');
    const diffError = runCheckerWithOutput(VERIFY_PR_SCRIPT, [], {
      PATH: orchestrationRoot,
      VPZH_VERIFY_PR_SCOPE_EXIT: '2',
      VPZH_VERIFY_PR_DIFF_EXIT: '0',
    });
    assertStatus(diffError.status, EXIT.error, 'verify:pr short-circuit checker error');
    if (readFileSync(logPath, 'utf8').trim() !== 'verify\ncheck:task-contract\ncheck:task-scope')
      throw new Error('verify:pr launched gates after a checker error');
    writeFileSync(logPath, '');
    const missingRunner = mkdtempSync(join(tmpdir(), 'vpzh-008-no-runner-'));
    try {
      const runnerError = runCheckerWithOutput(VERIFY_PR_SCRIPT, [], {
        PATH: missingRunner,
      });
      assertStatus(runnerError.status, EXIT.error, 'verify:pr missing runner error');
      assertOutput(runnerError, 'VERIFY_PR_ERROR', 'verify:pr missing runner marker');
      if (readFileSync(logPath, 'utf8').trim() !== '')
        throw new Error('verify:pr launched gates when pnpm was unavailable');
    } finally {
      rmSync(missingRunner, { force: true, recursive: true });
    }
    const unexpectedExit = runCheckerWithOutput(VERIFY_PR_SCRIPT, [], {
      PATH: orchestrationRoot,
      VPZH_VERIFY_PR_UNEXPECTED_EXIT: '3',
    });
    assertStatus(unexpectedExit.status, EXIT.error, 'verify:pr unexpected child exit error');
    assertOutput(unexpectedExit, 'VERIFY_PR_ERROR', 'verify:pr unexpected child exit marker');
    if (readFileSync(logPath, 'utf8').trim() !== 'verify\ncheck:task-contract')
      throw new Error('verify:pr launched gates after an unexpected child exit');
  } finally {
    rmSync(orchestrationRoot, { force: true, recursive: true });
  }
  runSecretFixture({}, EXIT.pass, 'secret clean pass');
  const placeholder = ['TOKEN', '=', '${', 'TOKEN_FROM_ENV', '}'].join('');
  runSecretFixture({ '.env.example': `${placeholder}\n` }, EXIT.pass, 'secret placeholder pass');
  runSecretFixture(
    { 'config/.env': 'EMPTY=\n' },
    EXIT.violation,
    'secret nested env filename violation',
  );
  const privateKey = ['-----BEGIN ', 'PRIVATE KEY-----', '\nfixture\n'].join('');
  runSecretFixture({ 'private.pem': privateKey }, EXIT.violation, 'secret private key violation');
  const githubToken = `ghp_${'A'.repeat(36)}`;
  runSecretFixture(
    { 'token.txt': githubToken },
    EXIT.violation,
    'secret github token violation',
    githubToken,
  );
  runSecretFixture({ '.env': 'TOKEN=test\n' }, EXIT.violation, 'secret tracked env violation');
  const committed = createSecretFixture();
  try {
    const value = `SECRET=${'R'.repeat(32)}`;
    writeFixtureFile(committed.root, 'committed.txt', value);
    commitFixture(committed.root, 'secret fixture');
    const result = runCheckerWithOutput(SECRETS_SCRIPT, ['--root', committed.root], {
      DIFF_BASE: committed.base,
    });
    assertStatus(result.status, EXIT.violation, 'secret committed state violation');
    if (`${result.stdout}\n${result.stderr}`.includes(value))
      throw new Error('secret committed state value was printed');
  } finally {
    rmSync(committed.root, { force: true, recursive: true });
  }
  const secretError = createSecretFixture();
  try {
    assertStatus(
      runChecker(SECRETS_SCRIPT, ['--root', secretError.root], {}),
      EXIT.error,
      'secret missing base error',
    );
  } finally {
    rmSync(secretError.root, { force: true, recursive: true });
  }

  const cleanReport = JSON.stringify({
    metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 } },
  });
  const moderateReport = JSON.stringify({
    metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 1, low: 0 } },
  });
  const highReport = JSON.stringify({
    metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0 } },
  });
  runDependencyFixture(cleanReport, EXIT.pass, 'dependency clean audit pass');
  const moderate = runDependencyFixture(
    moderateReport,
    EXIT.pass,
    'dependency moderate audit warning',
    1,
  );
  assertOutput(moderate, 'DEPENDENCY_AUDIT_WARNING', 'dependency moderate warning marker');
  const high = runDependencyFixture(
    highReport,
    EXIT.violation,
    'dependency high audit violation',
    1,
  );
  assertOutput(high, 'DEPENDENCY_VIOLATION', 'dependency high violation marker');
  const malformed = runDependencyFixture('{bad', EXIT.error, 'dependency malformed audit error');
  assertOutput(malformed, 'CHECKER ERROR dependency hygiene', 'dependency malformed audit marker');
  runDependencyFixture('', EXIT.error, 'dependency audit infrastructure error', 1);
  runDependencyConfigFixture(
    (root) => {
      const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
      packageJson.dependencies.fixture = '^1.2.3';
      writeFileSync(join(root, 'package.json'), JSON.stringify(packageJson));
    },
    EXIT.violation,
    'dependency unpinned spec violation',
  );
  for (const spec of ['1.x', '1.2.x', '<2.0.0', '1.0.0 || 2.0.0', 'beta']) {
    runDependencyConfigFixture(
      (root) => {
        const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
        packageJson.dependencies.fixture = spec;
        writeFileSync(join(root, 'package.json'), JSON.stringify(packageJson));
      },
      EXIT.violation,
      `dependency non-exact spec violation (${spec})`,
    );
  }
  runDependencyConfigFixture(
    (root) => {
      const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
      packageJson.packageManager = 'pnpm@11';
      writeFileSync(join(root, 'package.json'), JSON.stringify(packageJson));
    },
    EXIT.violation,
    'dependency package manager pin violation',
  );
  runDependencyConfigFixture(
    (root) => {
      const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
      packageJson.engines.pnpm = '11.6.0';
      writeFileSync(join(root, 'package.json'), JSON.stringify(packageJson));
    },
    EXIT.violation,
    'dependency package manager engine mismatch violation',
  );
  runDependencyConfigFixture(
    (root) => {
      const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
      delete packageJson.dependencies.fixture;
      writeFileSync(join(root, 'package.json'), JSON.stringify(packageJson));
    },
    EXIT.violation,
    'dependency missing lock entry violation',
  );
  runDependencyConfigFixture(
    (root) => {
      writeFileSync(join(root, 'pnpm-lock.yaml'), 'not: [valid');
    },
    EXIT.error,
    'dependency malformed lock error',
  );
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
    {
      name: 'secret scanner missing DIFF_BASE configuration error',
      script: SECRETS_SCRIPT,
      args: [],
      environment: {},
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
  runNewCheckerFixtureCases();

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
