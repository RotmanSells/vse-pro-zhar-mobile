import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const EXIT = { pass: 0, error: 2 };
const TASK_TITLE = /^(VPZH-[0-9]{3,})(?:\s+.+)$/u;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  if (argv[index + 1] === undefined) throw new Error(`${name} requires a value`);
  return argv[index + 1];
}

export function resolvePrTaskId(title) {
  if (typeof title !== 'string') throw new Error('PR title is required');
  const match = TASK_TITLE.exec(title.trimEnd());
  if (!match) throw new Error('PR title must start with VPZH-XXX and a title');
  return match[1];
}

function main() {
  const title = optionValue(process.argv.slice(2), '--title') ?? process.env.PR_TITLE;
  console.log(resolvePrTaskId(title));
  return EXIT.pass;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`PR_TASK_ID_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT.error);
  }
}
