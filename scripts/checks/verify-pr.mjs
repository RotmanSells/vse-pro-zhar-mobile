import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readCommittedDiff } from './git-diff.mjs';
import { isDocsOnlyChange } from '../lib/verification-impact.mjs';

const EXIT = { pass: 0, violation: 1, error: 2 };
const GATES = [
  'verify',
  'check:task-contract',
  'check:task-scope',
  'check:diff-size',
  'check:secrets',
  'check:dependencies',
];

function verificationGates({ env, cwd }) {
  if (env.DIFF_BASE === undefined || env.DIFF_BASE.length === 0) return GATES;
  const diff = readCommittedDiff({ base: env.DIFF_BASE, root: cwd });
  const changedPaths = diff.changes.flatMap((change) => change.paths);
  if (verificationModeForPaths(changedPaths) !== 'docs-only') return GATES;
  return ['verify:task', ...GATES.slice(1)];
}

export function verificationModeForPaths(paths) {
  return isDocsOnlyChange(paths) ? 'docs-only' : 'full';
}

export function runPrVerification({
  env = process.env,
  cwd = process.cwd(),
  runner = 'pnpm',
} = {}) {
  const gates = verificationGates({ cwd, env });
  console.log(`VERIFY_PR_MODE: ${gates[0] === 'verify:task' ? 'docs-only' : 'full'}`);
  for (const gate of gates) {
    const result = spawnSync(runner, [gate], {
      cwd,
      encoding: 'utf8',
      env: { ...env },
      stdio: 'inherit',
    });
    if (result.error) {
      console.error(`VERIFY_PR_ERROR: cannot run ${gate}: ${result.error.message}`);
      return EXIT.error;
    }
    if (result.signal !== null) {
      console.error(`VERIFY_PR_ERROR: ${gate} terminated by ${result.signal}`);
      return EXIT.error;
    }
    if (result.status !== 0) {
      if (result.status === 1 || result.status === 2) return result.status;
      console.error(`VERIFY_PR_ERROR: ${gate} returned unexpected exit ${result.status}`);
      return EXIT.error;
    }
  }
  return EXIT.pass;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(runPrVerification());
  } catch (error) {
    console.error(`VERIFY_PR_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT.error);
  }
}
