import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readCommittedDiff } from './git-diff.mjs';
import { loadSelectedTask, optionValue, TaskContractViolation } from './task-context.mjs';

const EXIT = { pass: 0, violation: 1, error: 2 };

function escapeRegexCharacter(character) {
  return /[\\^$.*+?()[\]{}|]/u.test(character) ? `\\${character}` : character;
}

function globToRegex(pattern) {
  const normalized = pattern.replaceAll('\\', '/').replace(/^\.\//u, '');
  let expression = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];
    if (character === '*' && next === '*') {
      if (normalized[index + 2] === '/') {
        expression += '(?:.*/)?';
        index += 2;
      } else {
        expression += '.*';
        index += 1;
      }
    } else if (character === '*') {
      expression += '[^/]*';
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += escapeRegexCharacter(character);
    }
  }
  return new RegExp(`^${expression}$`, 'u');
}

function matchesScopePath(path, scopePatterns) {
  const normalizedPath = path.replaceAll('\\', '/').replace(/^\.\//u, '');
  return scopePatterns.some((pattern) => globToRegex(pattern).test(normalizedPath));
}

function main() {
  const argv = process.argv.slice(2);
  const root = resolve(process.cwd(), optionValue(argv, '--root', '.'));
  const schemaPath = resolve(
    process.cwd(),
    optionValue(argv, '--schema', 'contracts/tasks/task.schema.json'),
  );
  const head = optionValue(argv, '--head', 'HEAD');

  try {
    const { task, taskId } = loadSelectedTask({ root, schemaPath });
    const diff = readCommittedDiff({ base: process.env.DIFF_BASE, head, root });
    const offendingPaths = [
      ...new Set(
        diff.changes
          .flatMap((change) => change.paths)
          .filter((path) => !matchesScopePath(path, task.scope.paths)),
      ),
    ];
    if (offendingPaths.length > 0) {
      for (const path of offendingPaths) {
        console.error(`TASK_SCOPE_VIOLATION: path is outside ${taskId} scope: ${path}`);
      }
      return EXIT.violation;
    }
    console.log(`PASS task scope: ${taskId}; checked ${diff.changes.length} change(s).`);
    return EXIT.pass;
  } catch (error) {
    if (error instanceof TaskContractViolation) {
      console.error(`TASK SCOPE VIOLATION: ${error.message}`);
      return EXIT.error;
    }
    throw error;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(
      `CHECKER ERROR task scope: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(EXIT.error);
  }
}
