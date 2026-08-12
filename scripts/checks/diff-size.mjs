import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readCommittedDiff } from './git-diff.mjs';
import { loadSelectedTask, optionValue, TaskContractViolation } from './task-context.mjs';

const EXIT = { pass: 0, violation: 1, error: 2 };
const GENERATED_PATTERNS = ['dist/**'];

function globToRegex(pattern) {
  let expression = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const next = pattern[index + 1];
    if (character === '*' && next === '*') {
      if (pattern[index + 2] === '/') {
        expression += '(?:.*/)?';
        index += 2;
      } else {
        expression += '.*';
        index += 1;
      }
    } else if (character === '*') {
      expression += '[^/]*';
    } else {
      expression += /[\\^$.*+?()[\]{}|]/u.test(character) ? `\\${character}` : character;
    }
  }
  return new RegExp(`^${expression}$`, 'u');
}

function categoryForPath(path, binary) {
  const normalizedPath = path.replaceAll('\\', '/');
  if (binary) {
    return 'binary';
  }
  if (normalizedPath === 'pnpm-lock.yaml' || normalizedPath.endsWith('/pnpm-lock.yaml')) {
    return 'lockfile';
  }
  if (normalizedPath.endsWith('.snap') || normalizedPath.includes('/__snapshots__/')) {
    return 'snapshot';
  }
  if (GENERATED_PATTERNS.some((pattern) => globToRegex(pattern).test(normalizedPath))) {
    return 'generated';
  }
  return 'meaningful';
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
    const { taskId } = loadSelectedTask({ root, schemaPath });
    const diff = readCommittedDiff({ base: process.env.DIFF_BASE, head, root });
    const counts = { binary: 0, generated: 0, lockfile: 0, meaningful: 0, snapshot: 0 };
    for (const record of diff.numstat) {
      const category = categoryForPath(record.path, record.binary);
      if (category === 'binary') {
        counts.binary += 1;
      } else {
        counts[category] += record.additions + record.deletions;
      }
    }
    console.log(
      `DIFF_SIZE_SUMMARY: meaningful=${counts.meaningful}, generated=${counts.generated}, lockfile=${counts.lockfile}, snapshot=${counts.snapshot}, binary_files=${counts.binary}`,
    );
    if (counts.meaningful > 3000) {
      console.error(
        `DIFF_SIZE_VIOLATION: ${taskId} has ${counts.meaningful} meaningful changed lines; hard limit is 3000.`,
      );
      return EXIT.violation;
    }
    if (counts.meaningful > 2500) {
      console.warn('DIFF_SIZE_STRONG_WARNING: 2501-3000 meaningful lines require review.');
    } else if (counts.meaningful > 1200) {
      console.warn('DIFF_SIZE_REVIEW_WARNING: 1201-2500 meaningful lines require review.');
    }
    console.log(`PASS diff size: ${taskId}.`);
    return EXIT.pass;
  } catch (error) {
    if (error instanceof TaskContractViolation) {
      console.error(`DIFF SIZE VIOLATION: ${error.message}`);
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
      `CHECKER ERROR diff size: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(EXIT.error);
  }
}
