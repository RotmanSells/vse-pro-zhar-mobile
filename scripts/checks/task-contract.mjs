import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadSelectedTask, optionValue, TaskContractViolation } from './task-context.mjs';

const EXIT = { pass: 0, violation: 1, error: 2 };

function main() {
  const argv = process.argv.slice(2);
  const root = resolve(process.cwd(), optionValue(argv, '--root', '.'));
  const schemaPath = resolve(
    process.cwd(),
    optionValue(argv, '--schema', 'contracts/tasks/task.schema.json'),
  );

  try {
    const { taskId, taskPath } = loadSelectedTask({ root, schemaPath });
    console.log(`PASS task contract: ${taskId} resolved to ${taskPath}`);
    return EXIT.pass;
  } catch (error) {
    if (error instanceof TaskContractViolation) {
      console.error(`TASK CONTRACT VIOLATION: ${error.message}`);
      return EXIT.violation;
    }
    throw error;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(
      `CHECKER ERROR task contract: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(EXIT.error);
  }
}
