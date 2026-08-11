import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateTaskManifest } from './validate-task-manifest.mjs';

export const TASK_ID_PATTERN = /^VPZH-[0-9]{3,}$/u;

export class TaskContractViolation extends Error {
  constructor(message) {
    super(message);
    this.name = 'TaskContractViolation';
  }
}

export function optionValue(argv, name, fallback) {
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

export function selectedTaskId() {
  const taskId = process.env.TASK_ID;
  if (taskId === undefined || taskId.length === 0) {
    throw new Error('TASK_ID is required');
  }
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error('TASK_ID must match ^VPZH-[0-9]{3,}$');
  }
  return taskId;
}

export function loadSelectedTask({ root, schemaPath }) {
  const taskId = selectedTaskId();
  const taskPath = resolve(root, 'docs', 'tasks', `${taskId}.yaml`);
  if (!existsSync(taskPath)) {
    throw new TaskContractViolation(`selected manifest does not exist: ${taskPath}`);
  }

  const { errors, task, valid } = validateTaskManifest({ schemaPath, taskPath });
  if (!valid) {
    const details = errors
      .map((error) => `${error.instancePath || '/'} ${error.message ?? ''}`.trim())
      .join('; ');
    throw new TaskContractViolation(`selected manifest is schema-invalid: ${details}`);
  }
  if (task.id !== taskId) {
    throw new TaskContractViolation(
      `manifest id ${String(task.id)} does not match TASK_ID ${taskId}`,
    );
  }

  const manifestPath = `docs/tasks/${taskId}.yaml`;
  if (!task.scope.paths.includes(manifestPath)) {
    throw new TaskContractViolation(`scope.paths must include ${manifestPath}`);
  }

  return { task, taskId, taskPath };
}
