import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readCommittedDiff } from './git-diff.mjs';
import { discoverWorkspacePackages } from '../lib/workspace.mjs';
import {
  impactedWorkspacePackages,
  isDocsOnlyChange,
  isGlobalPackageImpactPath,
} from '../lib/verification-impact.mjs';

const EXIT = { pass: 0, violation: 1, error: 2 };
const POLICY_GATES = [
  'check:task-contract',
  'check:task-scope',
  'check:diff-size',
  'check:secrets',
  'check:dependencies',
];

function diffPaths({ env, cwd }) {
  const base = env.DIFF_BASE ?? 'HEAD';
  return readCommittedDiff({ base, root: cwd }).changes.flatMap((change) => change.paths);
}

export function verificationModeForPaths(paths) {
  return isDocsOnlyChange(paths) ? 'docs-only' : 'incremental';
}

function integrationPackagesForPaths(paths, impactedPackages) {
  const impactedKeys = new Set(impactedPackages.map((packageInfo) => packageInfo.importerKey));
  const globalImpact = paths.some(isGlobalPackageImpactPath);
  const packages = new Set();

  if (
    globalImpact ||
    impactedKeys.has('apps/api') ||
    impactedKeys.has('packages/contracts') ||
    paths.some((path) => path.startsWith('apps/api/') || path.startsWith('packages/contracts/'))
  ) {
    packages.add('api');
  }
  if (
    globalImpact ||
    impactedKeys.has('apps/admin') ||
    paths.some((path) => path.startsWith('apps/admin/'))
  ) {
    packages.add('admin');
  }
  return [...packages];
}

export function planPullRequest({ env = process.env, cwd = process.cwd() } = {}) {
  const paths = diffPaths({ env, cwd });
  const workspacePackages = discoverWorkspacePackages(cwd);
  const impactedPackages = impactedWorkspacePackages(paths, workspacePackages);
  return {
    changedPaths: paths,
    impactedPackages: impactedPackages.map((packageInfo) => packageInfo.importerKey),
    integrationPackages: integrationPackagesForPaths(paths, impactedPackages),
    mode: verificationModeForPaths(paths),
  };
}

function verificationGates({ plan = undefined }) {
  const gates = ['verify:task'];
  if (plan !== undefined) {
    if (plan.integrationPackages.includes('api')) gates.push('verify:api-integration');
    if (plan.integrationPackages.includes('admin')) gates.push('verify:admin-integration');
  }
  return [...gates, ...POLICY_GATES];
}

export function runPrVerification({
  env = process.env,
  cwd = process.cwd(),
  runner = 'pnpm',
} = {}) {
  if (process.argv.includes('--plan')) {
    console.log(JSON.stringify(planPullRequest({ env, cwd })));
    return EXIT.pass;
  }
  const plan =
    env.DIFF_BASE === undefined || env.DIFF_BASE.length === 0
      ? undefined
      : planPullRequest({ env, cwd });
  const gates = verificationGates({ plan });
  const mode = plan?.mode ?? 'incremental-working-tree';
  console.log(`VERIFY_PR_MODE: ${mode}`);
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
