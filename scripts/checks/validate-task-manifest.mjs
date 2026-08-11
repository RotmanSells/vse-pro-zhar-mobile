import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

export function validateTaskManifest({ schemaPath, taskPath }) {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const task = parse(readFileSync(taskPath, 'utf8'));
  // `scenario` is declared at the root and required only by a conditional branch.
  // Ajv's strictRequired check cannot follow that outer declaration across `then`.
  const ajv = new Ajv2020({ strict: true, strictRequired: false });
  const valid = ajv.validate(schema, task);

  return { errors: ajv.errors ?? [], task, valid };
}

function main() {
  const argv = process.argv.slice(2);
  const taskPath = resolve(process.cwd(), optionValue(argv, '--task', 'docs/tasks/VPZH-001.yaml'));
  const schemaPath = resolve(
    process.cwd(),
    optionValue(argv, '--schema', 'contracts/tasks/task.schema.json'),
  );
  const { errors, valid } = validateTaskManifest({ schemaPath, taskPath });
  if (valid) {
    console.log(`PASS task manifest schema: ${taskPath}`);
    return EXIT.pass;
  }
  for (const error of errors) {
    console.error(
      `TASK MANIFEST VIOLATION: ${error.instancePath || '/'} ${error.message ?? ''}`.trim(),
    );
  }
  return EXIT.violation;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(
      `CHECKER ERROR task manifest schema: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(EXIT.error);
  }
}
