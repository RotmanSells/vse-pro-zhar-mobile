import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { discoverWorkspacePackages } from '../lib/workspace.mjs';

const EXIT = { pass: 0, violation: 1, error: 2 };
const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];
const AUDIT_WAIVER_PATH = 'policy/dependency-audit-waiver.json';
const AUDIT_WAIVER_GHSAS = ['GHSA-5p2g-fcmc-qvqq', 'GHSA-w3rx-r6r6-pgpr'];
const EXACT_SEMVER =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

function optionValue(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  if (argv[index + 1] === undefined) throw new Error(`${name} requires a value`);
  return argv[index + 1];
}
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function fail(message) {
  console.error(`DEPENDENCY_VIOLATION: ${message}`);
}
function packageManagerVersion(packageJson) {
  const manager = packageJson.packageManager;
  const engine = packageJson.engines?.pnpm;
  const violations = [];
  if (typeof manager !== 'string' || !/^pnpm@\d+\.\d+\.\d+$/u.test(manager)) {
    violations.push('packageManager must pin an exact pnpm version');
  }
  const managerVersion = typeof manager === 'string' ? manager.slice('pnpm@'.length) : undefined;
  if (engine !== managerVersion)
    violations.push('engines.pnpm must match packageManager exact version');
  return violations;
}
function sameStringSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    actual.every((value) => typeof value === 'string' && expected.includes(value))
  );
}
function packageNameAndVersion(snapshotKey) {
  const canonical = snapshotKey.split('(', 1)[0];
  const separator = canonical.lastIndexOf('@');
  if (separator <= 0 || separator === canonical.length - 1) return undefined;
  return { name: canonical.slice(0, separator), version: canonical.slice(separator + 1) };
}
function dependencyPathExists(snapshots, path) {
  for (let index = 0; index < path.length - 1; index += 1) {
    const target = packageNameAndVersion(path[index + 1]);
    const expectedSource = packageNameAndVersion(path[index]);
    const sourceMatches = Object.entries(snapshots).filter(([key]) => {
      const source = packageNameAndVersion(key);
      return source?.name === expectedSource?.name && source?.version === expectedSource?.version;
    });
    if (
      !target ||
      !sourceMatches.some(([, source]) =>
        String(source.dependencies?.[target.name] ?? '').startsWith(target.version),
      )
    )
      return false;
  }
  return true;
}
function auditWaiverLockViolations(lock, policy) {
  const snapshots = lock.snapshots;
  if (!snapshots || typeof snapshots !== 'object')
    return ['pnpm-lock.yaml snapshots are required to validate the active audit waiver'];

  const imageSizeSnapshots = Object.keys(snapshots).filter((key) => key.startsWith('image-size@'));
  if (!sameStringSet(imageSizeSnapshots, ['image-size@1.2.1']))
    return [
      'active audit waiver requires exactly image-size@1.2.1 and no other image-size version',
    ];

  for (const path of policy.approvedDependencyPaths) {
    if (!dependencyPathExists(snapshots, path))
      return [`active audit waiver dependency path is absent or changed: ${path.join(' -> ')}`];
  }

  const imageSizeMetroSnapshots = Object.entries(snapshots)
    .filter(
      ([key, snapshot]) =>
        key.startsWith('metro@') && snapshot?.dependencies?.['image-size'] === '1.2.1',
    )
    .map(([key]) => key);
  const approvedMetroSnapshots = policy.approvedDependencyPaths
    .flat()
    .filter((key) => key.startsWith('metro@'));
  if (!sameStringSet(imageSizeMetroSnapshots, approvedMetroSnapshots))
    return [
      'active audit waiver Metro image-size dependency versions do not match the approved paths',
    ];
  return [];
}
function auditWaiverViolations(root) {
  const policyPath = resolve(root, AUDIT_WAIVER_PATH);
  const workspacePath = resolve(root, 'pnpm-workspace.yaml');
  let workspace;
  try {
    workspace = parse(readFileSync(workspacePath, 'utf8'));
  } catch (error) {
    return {
      policy: undefined,
      violations: [
        `pnpm-workspace.yaml must be readable to validate audit configuration: ${error.message}`,
      ],
    };
  }
  const configured = workspace?.auditConfig?.ignoreGhsas;
  if (configured === undefined && !existsSync(policyPath))
    return { policy: undefined, violations: [] };
  if (!existsSync(policyPath))
    return {
      policy: undefined,
      violations: [`${AUDIT_WAIVER_PATH} is required when auditConfig.ignoreGhsas is set`],
    };

  let policy;
  try {
    policy = readJson(policyPath);
  } catch (error) {
    return {
      policy: undefined,
      violations: [`${AUDIT_WAIVER_PATH} must contain valid JSON: ${error.message}`],
    };
  }

  const violations = [];
  const allowedKeys = new Set([
    'version',
    'ownerRiskAcceptance',
    'expiresOn',
    'allowedGhsas',
    'package',
    'approvedDependencyPaths',
    'reason',
  ]);
  for (const key of Object.keys(policy)) {
    if (!allowedKeys.has(key)) violations.push(`${AUDIT_WAIVER_PATH} has unsupported key '${key}'`);
  }
  if (policy.version !== 2) violations.push(`${AUDIT_WAIVER_PATH} version must be 2`);
  if (policy.ownerRiskAcceptance !== 'VPZH-012 owner decision')
    violations.push(`${AUDIT_WAIVER_PATH} must record the explicit VPZH-012 owner decision`);
  if (policy.package !== 'image-size@1.2.1')
    violations.push(`${AUDIT_WAIVER_PATH} must be limited to image-size@1.2.1`);
  const approvedPaths = [
    ['@expo/metro@56.0.0', 'metro@0.84.4', 'image-size@1.2.1'],
    [
      '@react-native/metro-config@0.87.0',
      'metro-config@0.87.0',
      'metro@0.87.0',
      'image-size@1.2.1',
    ],
  ];
  if (
    !Array.isArray(policy.approvedDependencyPaths) ||
    policy.approvedDependencyPaths.length !== approvedPaths.length ||
    !approvedPaths.every((path) =>
      policy.approvedDependencyPaths.some(
        (candidate) => Array.isArray(candidate) && candidate.join('\u0000') === path.join('\u0000'),
      ),
    )
  ) {
    violations.push(`${AUDIT_WAIVER_PATH} must list exactly the two approved Expo-Metro paths`);
  }
  if (typeof policy.reason !== 'string' || policy.reason.length === 0)
    violations.push(`${AUDIT_WAIVER_PATH} must document the accepted risk`);
  if (!sameStringSet(policy.allowedGhsas, AUDIT_WAIVER_GHSAS))
    violations.push(`${AUDIT_WAIVER_PATH} must list exactly the two approved image-size GHSAs`);
  if (typeof policy.expiresOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(policy.expiresOn)) {
    violations.push(`${AUDIT_WAIVER_PATH} must contain an ISO expiration date`);
  } else if (new Date(`${policy.expiresOn}T23:59:59.999Z`).getTime() < Date.now()) {
    violations.push(`${AUDIT_WAIVER_PATH} expired on ${policy.expiresOn}`);
  }

  if (!sameStringSet(configured, AUDIT_WAIVER_GHSAS))
    violations.push(
      'pnpm-workspace.yaml auditConfig.ignoreGhsas must list exactly the two approved image-size GHSAs',
    );
  return { policy, violations };
}
function directSpecs(packageJson) {
  const specs = new Map();
  const violations = [];
  for (const section of SECTIONS) {
    for (const [name, spec] of Object.entries(packageJson[section] ?? {})) {
      if (typeof spec !== 'string' || (!spec.startsWith('workspace:') && !EXACT_SEMVER.test(spec)))
        violations.push(`${section}.${name} must use an exact semver or workspace: spec`);
      const previous = specs.get(name);
      if (previous !== undefined && previous.spec !== spec)
        violations.push(`${name} has conflicting specs in ${previous.section} and ${section}`);
      specs.set(name, { section, spec });
    }
  }
  return { specs, violations };
}
function lockSpecs(lockfile, importerKey) {
  const importer = lockfile.importers?.[importerKey];
  if (!importer || typeof importer !== 'object')
    throw new Error(`pnpm-lock.yaml importer '${importerKey}' is missing`);
  const result = new Map();
  for (const section of SECTIONS) {
    for (const [name, value] of Object.entries(importer[section] ?? {})) {
      if (typeof value?.specifier !== 'string')
        throw new Error(`lockfile importer entry is malformed: ${name}`);
      result.set(name, value.specifier);
    }
  }
  return result;
}
function compareImporterSpecs(packageJson, importerKey, lockfile, missingIsError = false) {
  const violations = [];
  const { specs, violations: specViolations } = directSpecs(packageJson);
  violations.push(...specViolations);
  const importer = lockfile.importers?.[importerKey];
  if (!importer || typeof importer !== 'object') {
    if (missingIsError) {
      throw new Error(`pnpm-lock.yaml importer '${importerKey}' is missing`);
    }
    violations.push(`${importerKey} is missing from lockfile importers`);
    return violations;
  }

  if (specs.size === 0) {
    for (const section of SECTIONS) {
      for (const name of Object.keys(importer[section] ?? {})) {
        violations.push(`${name} is present in lockfile but not package.json direct dependencies`);
      }
    }
    return violations;
  }

  let locked;
  try {
    locked = lockSpecs(lockfile, importerKey);
  } catch (error) {
    if (missingIsError) {
      throw error;
    }
    violations.push(
      `${importerKey} is missing from lockfile importers: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return violations;
  }
  for (const [name, { spec }] of specs) {
    if (locked.get(name) !== spec) {
      violations.push(`${name} package.json specifier does not match lockfile`);
    }
  }
  for (const name of locked.keys()) {
    if (!specs.has(name)) {
      violations.push(`${name} is present in lockfile but not package.json direct dependencies`);
    }
  }
  return violations;
}

function runAudit(root) {
  const result = spawnSync('pnpm', ['audit', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error)
    throw new Error(`pnpm audit failed: ${result.error.message}`, { cause: result.error });
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`pnpm audit returned malformed JSON: ${error.message}`, { cause: error });
  }
  const advisoryEntries = Object.values(report.advisories ?? {});
  const vulnerabilities = report.metadata?.vulnerabilities ?? report.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== 'object')
    throw new Error(
      `pnpm audit response has no vulnerability summary${result.status === 0 ? '' : ` (exit ${result.status})`}`,
    );
  const counts = { critical: 0, high: 0, moderate: 0, low: 0 };
  if (advisoryEntries.length > 0) {
    for (const advisory of advisoryEntries) {
      const severity = advisory?.severity;
      if (
        severity === 'critical' ||
        severity === 'high' ||
        severity === 'moderate' ||
        severity === 'low'
      )
        counts[severity] += 1;
    }
  } else {
    counts.critical = Number(vulnerabilities.critical ?? 0);
    counts.high = Number(vulnerabilities.high ?? 0);
    counts.moderate = Number(vulnerabilities.moderate ?? 0);
    counts.low = Number(vulnerabilities.low ?? 0);
  }
  console.log(
    `DEPENDENCY_AUDIT_SUMMARY: critical=${counts.critical}, high=${counts.high}, moderate=${counts.moderate}, low=${counts.low}`,
  );
  if (counts.moderate > 0 || counts.low > 0)
    console.warn('DEPENDENCY_AUDIT_WARNING: moderate/low vulnerabilities require review.');
  return counts.high > 0 || counts.critical > 0;
}
function main() {
  const argv = process.argv.slice(2);
  const root = resolve(process.cwd(), optionValue(argv, '--root', '.'));
  const packagePath = resolve(root, 'package.json');
  const lockPath = resolve(root, 'pnpm-lock.yaml');
  if (!existsSync(packagePath) || !existsSync(lockPath))
    throw new Error('package.json and pnpm-lock.yaml are required');
  const packageJson = readJson(packagePath);
  const lock = parse(readFileSync(lockPath, 'utf8'));
  const waiver = auditWaiverViolations(root);
  const violations = [...packageManagerVersion(packageJson), ...waiver.violations];
  if (waiver.policy !== undefined && waiver.violations.length === 0)
    violations.push(...auditWaiverLockViolations(lock, waiver.policy));
  violations.push(...compareImporterSpecs(packageJson, '.', lock, true));

  const workspacePackages = discoverWorkspacePackages(root);
  const workspaceImporterKeys = new Set(
    workspacePackages.map((workspacePackage) => workspacePackage.importerKey),
  );
  for (const importerKey of Object.keys(lock.importers ?? {})) {
    if (importerKey !== '.' && !workspaceImporterKeys.has(importerKey)) {
      violations.push(
        `orphan workspace lockfile importer '${importerKey}' has no discovered package`,
      );
    }
  }
  for (const workspacePackage of workspacePackages) {
    violations.push(
      ...compareImporterSpecs(workspacePackage.manifest, workspacePackage.importerKey, lock),
    );
  }
  if (violations.length > 0) {
    for (const message of violations) fail(message);
    return EXIT.violation;
  }
  if (runAudit(root)) {
    fail('pnpm audit reports high or critical vulnerabilities');
    return EXIT.violation;
  }
  console.log('PASS dependency hygiene.');
  return EXIT.pass;
}
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(
      `CHECKER ERROR dependency hygiene: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(EXIT.error);
  }
}
