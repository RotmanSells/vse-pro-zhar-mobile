import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { discoverWorkspacePackages } from '../lib/workspace.mjs';

const EXIT = { pass: 0, violation: 1, error: 2 };
const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];
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
  const vulnerabilities = report.metadata?.vulnerabilities ?? report.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== 'object')
    throw new Error(
      `pnpm audit response has no vulnerability summary${result.status === 0 ? '' : ` (exit ${result.status})`}`,
    );
  const high = Number(vulnerabilities.high ?? 0);
  const critical = Number(vulnerabilities.critical ?? 0);
  const moderate = Number(vulnerabilities.moderate ?? 0);
  const low = Number(vulnerabilities.low ?? 0);
  console.log(
    `DEPENDENCY_AUDIT_SUMMARY: critical=${critical}, high=${high}, moderate=${moderate}, low=${low}`,
  );
  if (moderate > 0 || low > 0)
    console.warn('DEPENDENCY_AUDIT_WARNING: moderate/low vulnerabilities require review.');
  return high > 0 || critical > 0;
}
function main() {
  const argv = process.argv.slice(2);
  const root = resolve(process.cwd(), optionValue(argv, '--root', '.'));
  const packagePath = resolve(root, 'package.json');
  const lockPath = resolve(root, 'pnpm-lock.yaml');
  if (!existsSync(packagePath) || !existsSync(lockPath))
    throw new Error('package.json and pnpm-lock.yaml are required');
  const packageJson = readJson(packagePath);
  const violations = packageManagerVersion(packageJson);
  const lock = parse(readFileSync(lockPath, 'utf8'));
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
