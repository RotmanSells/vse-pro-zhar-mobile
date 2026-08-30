import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { loadSelectedTask, optionValue, TaskContractViolation } from './task-context.mjs';

const EXIT = { pass: 0, violation: 1, error: 2 };
const SHA_PATTERN = /^[0-9a-f]{40}$/u;

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch (error) {
    const detail = error?.stderr === undefined ? '' : `: ${String(error.stderr).trim()}`;
    throw new Error(`git ${args.join(' ')} failed${detail}`, { cause: error });
  }
}

export function validateTaskBase({
  root,
  taskId,
  task,
  diffBase = process.env.DIFF_BASE,
  gitCommand = git,
}) {
  const baseCommit = task.base_commit;
  if (typeof baseCommit !== 'string' || !SHA_PATTERN.test(baseCommit)) {
    throw new TaskContractViolation(
      `${taskId} must declare a 40-character lowercase base_commit before implementation`,
    );
  }

  const originMain = gitCommand(root, ['rev-parse', 'origin/main^{commit}']);
  if (originMain !== baseCommit) {
    throw new TaskContractViolation(
      `${taskId} base_commit=${baseCommit} does not match origin/main=${originMain}; fetch and reconcile the task base before implementation`,
    );
  }

  const head = gitCommand(root, ['rev-parse', 'HEAD^{commit}']);
  try {
    gitCommand(root, ['merge-base', '--is-ancestor', baseCommit, head]);
  } catch (error) {
    throw new TaskContractViolation(
      `${taskId} HEAD=${head} is not based on base_commit=${baseCommit}; create or rebase the task worktree from origin/main`,
      { cause: error },
    );
  }

  if (diffBase !== undefined && diffBase.length > 0 && diffBase !== baseCommit) {
    throw new TaskContractViolation(
      `${taskId} DIFF_BASE=${diffBase} does not match manifest base_commit=${baseCommit}; update the branch from origin/main and reconcile the manifest`,
    );
  }

  const branch = gitCommand(root, ['branch', '--show-current']);
  if (branch === 'main' || branch === 'master') {
    throw new TaskContractViolation(
      `${taskId} must be implemented on a task branch/worktree, not ${branch}`,
    );
  }

  return { baseCommit, branch };
}

function main() {
  const argv = process.argv.slice(2);
  const root = resolve(process.cwd(), optionValue(argv, '--root', '.'));
  const schemaPath = resolve(
    process.cwd(),
    optionValue(argv, '--schema', 'contracts/tasks/task.schema.json'),
  );

  try {
    const { taskId, task } = loadSelectedTask({ root, schemaPath });
    const { baseCommit, branch } = validateTaskBase({ root, taskId, task });
    console.log(`PASS task base: ${taskId} uses origin/main ${baseCommit} on ${branch}`);
    return EXIT.pass;
  } catch (error) {
    if (error instanceof TaskContractViolation) {
      console.error(`TASK BASE VIOLATION: ${error.message}`);
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
      `CHECKER ERROR task base: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(EXIT.error);
  }
}
