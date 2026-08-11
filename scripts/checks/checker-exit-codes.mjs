import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };

function runChecker(script, args) {
  const result = spawnSync(process.execPath, [resolve(process.cwd(), script), ...args], {
    encoding: 'utf8',
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
      name: 'automation synchronization configuration error',
      script: 'scripts/checks/automation-sync.mjs',
      args: ['--registry', 'scripts/checks/fixtures/automation-sync/malformed-registry.json'],
      expected: EXIT.error,
    },
  ];
  const failures = [];
  for (const testCase of cases) {
    const actual = runChecker(testCase.script, testCase.args);
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
