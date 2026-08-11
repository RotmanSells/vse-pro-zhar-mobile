import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };

function runChecker(script, args, environment = {}) {
  const result = spawnSync(process.execPath, [resolve(process.cwd(), script), ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  return result.status;
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

  if (failures.length === 0) {
    console.log(`PASS checker exit-code contract: ${cases.length} contract cases verified.`);
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
