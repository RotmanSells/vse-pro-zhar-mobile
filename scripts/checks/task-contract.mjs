import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateTaskManifest } from './validate-task-manifest.mjs';

const EXIT = { pass: 0, violation: 1, error: 2 };
const TASK_ID_PATTERN = /^VPZH-[0-9]{3,}$/u;

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

function selectedTaskId() {
  const taskId = process.env.TASK_ID;
  if (taskId === undefined || taskId.length === 0) {
    throw new Error('TASK_ID is required');
  }
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error('TASK_ID must match ^VPZH-[0-9]{3,}$');
  }
  return taskId;
}

function printSchemaViolations(errors) {
  for (const error of errors) {
    console.error(
      `TASK CONTRACT VIOLATION: ${error.instancePath || '/'} ${error.message ?? ''}`.trim(),
    );
  }
}

function main() {
  const taskId = selectedTaskId();
  const argv = process.argv.slice(2);
  const root = resolve(process.cwd(), optionValue(argv, '--root', '.'));
  const schemaPath = resolve(
    process.cwd(),
    optionValue(argv, '--schema', 'contracts/tasks/task.schema.json'),
  );
  const taskPath = resolve(root, 'docs', 'tasks', `${taskId}.yaml`);

  if (!existsSync(taskPath)) {
    console.error(`TASK CONTRACT VIOLATION: selected manifest does not exist: ${taskPath}`);
    return EXIT.violation;
  }

  const { errors, task, valid } = validateTaskManifest({ schemaPath, taskPath });
  if (!valid) {
    printSchemaViolations(errors);
    return EXIT.violation;
  }

  const violations = [];
  if (task.id !== taskId) {
    violations.push(`manifest id ${String(task.id)} does not match TASK_ID ${taskId}`);
  }
  const manifestPath = `docs/tasks/${taskId}.yaml`;
  if (!task.scope.paths.includes(manifestPath)) {
    violations.push(`scope.paths must include ${manifestPath}`);
  }

  if (violations.length === 0) {
    console.log(`PASS task contract: ${taskId} resolved to ${taskPath}`);
    return EXIT.pass;
  }
  for (const violation of violations) {
    console.error(`TASK CONTRACT VIOLATION: ${violation}`);
  }
  return EXIT.violation;
}

try {
  process.exit(main());
} catch (error) {
  console.error(
    `CHECKER ERROR task contract: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(EXIT.error);
}
