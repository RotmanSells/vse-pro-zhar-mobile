import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const EXIT = { pass: 0, violation: 1, error: 2 };

function main() {
  const taskPath = resolve(process.cwd(), 'docs/tasks/VPZH-010.yaml');
  const task = parse(readFileSync(taskPath, 'utf8'));
  const adrId = task?.adr;
  if (typeof adrId !== 'string' || !/^ADR-\d+$/u.test(adrId)) {
    console.error('ADR VIOLATION: VPZH-010 must reference an accepted ADR.');
    return EXIT.violation;
  }

  const adrDirectory = resolve(process.cwd(), 'docs/adr');
  if (!existsSync(adrDirectory)) {
    console.error(`ADR VIOLATION: referenced ADR does not exist: docs/adr/${adrId}.md`);
    return EXIT.violation;
  }
  const adrFile = readdirSync(adrDirectory).find(
    (file) => file === `${adrId}.md` || file.startsWith(`${adrId}-`),
  );
  if (adrFile === undefined) {
    console.error(`ADR VIOLATION: referenced ADR does not exist: docs/adr/${adrId}.md`);
    return EXIT.violation;
  }
  const adrPath = resolve(adrDirectory, adrFile);
  const adr = readFileSync(adrPath, 'utf8');
  if (!/^[-] Status: Accepted$/mu.test(adr)) {
    console.error(`ADR VIOLATION: ${adrId} is not accepted.`);
    return EXIT.violation;
  }

  console.log(`PASS ADR check: ${adrId} is accepted and referenced by VPZH-010.`);
  return EXIT.pass;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`CHECKER ERROR ADR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(EXIT.error);
}
