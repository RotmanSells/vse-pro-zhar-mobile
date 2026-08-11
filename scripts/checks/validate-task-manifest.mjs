import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';

const EXIT = { pass: 0, violation: 1, error: 2 };

function optionValue(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = argv[index + 1];
  if (value === undefined) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function main() {
  const argv = process.argv.slice(2);
  const taskPath = resolve(process.cwd(), optionValue(argv, '--task', 'docs/tasks/VPZH-001.yaml'));
  const schemaPath = resolve(
    process.cwd(),
    optionValue(argv, '--schema', 'contracts/tasks/task.schema.json'),
  );
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const task = parse(readFileSync(taskPath, 'utf8'));
  // `scenario` is declared at the root and required only by a conditional branch.
  // Ajv's strictRequired check cannot follow that outer declaration across `then`.
  const ajv = new Ajv2020({ strict: true, strictRequired: false });
  const valid = ajv.validate(schema, task);
  if (valid) {
    console.log(`PASS task manifest schema: ${taskPath}`);
    return EXIT.pass;
  }
  for (const error of ajv.errors ?? []) {
    console.error(
      `TASK MANIFEST VIOLATION: ${error.instancePath || '/'} ${error.message ?? ''}`.trim(),
    );
  }
  return EXIT.violation;
}

try {
  process.exit(main());
} catch (error) {
  console.error(
    `CHECKER ERROR task manifest schema: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(EXIT.error);
}
