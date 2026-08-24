import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, resolve } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };
const LAYERS = new Set([
  'presentation',
  'application',
  'domain',
  'infrastructure',
  'composition',
  'shared-contracts',
]);
const ALLOWED_LAYER_EDGES = new Set([
  'presentation:application',
  'presentation:shared-contracts',
  'application:domain',
  'application:shared-contracts',
  'domain:shared-contracts',
  'infrastructure:application',
  'infrastructure:domain',
  'infrastructure:shared-contracts',
]);
const FRAMEWORK_PRESENTATION_PATTERNS = [
  /(?:^|\/)apps\/[^/]+\/(?:src\/)?app\//u,
  /(?:^|\/)apps\/[^/]+\/(?:src\/)?pages\//u,
];
const PRODUCTION_SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);
const NON_PRODUCTION_DIRECTORY_NAMES = new Set([
  '.expo',
  '.generated',
  '.next',
  'build',
  'coverage',
  'dist',
  'generated',
  'test',
  'tests',
  '__tests__',
  'fixtures',
]);
const NON_PRODUCTION_MIGRATION_DIRECTORY = 'migrations';
const NON_PRODUCTION_FILE_PATTERN = /(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/u;
const DECLARATION_FILE_PATTERN = /(?:\.d\.)[^/]+$/u;
const CONFIG_FILE_PATTERN = /(?:^|\/)[^/]+\.config\.[^/]+$/u;

function allowedNpmDependencies() {
  const policyPath = resolve(process.cwd(), 'policy/architecture-dependencies.json');
  if (!existsSync(policyPath)) {
    throw new Error(`Architecture dependency policy does not exist: ${policyPath}`);
  }
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  if (
    policy === null ||
    typeof policy !== 'object' ||
    policy.restrictedLayerAllowedNpmDependencies === null ||
    typeof policy.restrictedLayerAllowedNpmDependencies !== 'object'
  ) {
    throw new Error(
      'Architecture dependency policy has an invalid restrictedLayerAllowedNpmDependencies value',
    );
  }
  return policy.restrictedLayerAllowedNpmDependencies;
}

function architectureEntrypointPolicy() {
  const policyPath = resolve(process.cwd(), 'policy/architecture-entrypoints.json');
  if (!existsSync(policyPath)) {
    throw new Error(`Architecture entrypoint policy does not exist: ${policyPath}`);
  }
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  if (policy === null || typeof policy !== 'object') {
    throw new Error('Architecture entrypoint policy must be an object');
  }
  for (const key of [
    'compositionEntrypointPatterns',
    'sharedContractPatterns',
    'toolingSourcePatterns',
  ]) {
    if (
      !Array.isArray(policy[key]) ||
      policy[key].some((pattern) => typeof pattern !== 'string' || pattern.length === 0)
    ) {
      throw new Error(`Architecture entrypoint policy ${key} must be a non-empty string array`);
    }
  }
  return policy;
}

function globPatternToRegExp(pattern) {
  let expression = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      expression += '.*';
      index += 1;
    } else if (character === '*') {
      expression += '[^/]*';
    } else {
      expression += character.replace(/[\\^$+?.()|{}]/gu, '\\$&');
    }
  }
  return new RegExp(`(?:^|/)${expression}$`, 'u');
}

function matchesPolicyPattern(path, patterns) {
  return patterns.some((pattern) => globPatternToRegExp(pattern).test(path));
}

function isFrameworkPresentationPath(path) {
  const normalizedPath = path.replaceAll('\\', '/');
  return FRAMEWORK_PRESENTATION_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}

function isApprovedCompositionRoot(path, policy) {
  return matchesPolicyPattern(path.replaceAll('\\', '/'), policy.compositionEntrypointPatterns);
}

function isAllowedNpmDependency(packageName, allowedPackages) {
  return allowedPackages.some(
    (allowedPackage) =>
      packageName === allowedPackage || packageName.startsWith(`${allowedPackage}/`),
  );
}

function parseArguments(argv) {
  const targetIndex = argv.indexOf('--target');
  const configIndex = argv.indexOf('--config');
  const target = targetIndex === -1 ? undefined : argv[targetIndex + 1];
  const config = configIndex === -1 ? 'dependency-cruiser.cjs' : argv[configIndex + 1];
  if (
    (targetIndex !== -1 && target === undefined) ||
    (configIndex !== -1 && config === undefined)
  ) {
    throw new Error('--target and --config require a value');
  }

  return {
    config: resolve(process.cwd(), config),
    targets:
      target === undefined
        ? ['apps', 'packages', 'src'].map((path) => resolve(process.cwd(), path)).filter(existsSync)
        : [resolve(process.cwd(), target)],
  };
}

function sourceRelativePath(path) {
  const normalizedPath = path.replaceAll('\\', '/');
  const workspaceMatch = /(?:^|\/)(?:apps|packages)\/[^/]+\/(.+)$/u.exec(normalizedPath);
  if (workspaceMatch !== null) {
    return workspaceMatch[1];
  }
  if (normalizedPath.includes('/node_modules/')) {
    return undefined;
  }
  const rootSourceMatch = /(?:^|\/)src\/(.+)$/u.exec(normalizedPath);
  return rootSourceMatch === null ? undefined : rootSourceMatch[1];
}

function isProductionSource(path, policy) {
  const normalizedPath = path.replaceAll('\\', '/');
  const relativePath = sourceRelativePath(normalizedPath);
  if (relativePath === undefined || !PRODUCTION_SOURCE_EXTENSIONS.has(extname(normalizedPath))) {
    return false;
  }
  const relativeSegments = relativePath.split('/');
  if (
    relativeSegments.some((segment) => NON_PRODUCTION_DIRECTORY_NAMES.has(segment)) ||
    relativeSegments.includes(NON_PRODUCTION_MIGRATION_DIRECTORY) ||
    NON_PRODUCTION_FILE_PATTERN.test(relativePath) ||
    DECLARATION_FILE_PATTERN.test(relativePath) ||
    CONFIG_FILE_PATTERN.test(relativePath) ||
    matchesPolicyPattern(normalizedPath, policy.toolingSourcePatterns)
  ) {
    return false;
  }
  return true;
}

function layerOf(path, policy) {
  const normalizedPath = path.replaceAll('\\', '/');
  const segments = normalizedPath.split('/').map((segment) => segment.toLowerCase());
  const explicitLayer = segments.find((segment) => LAYERS.has(segment));
  if (explicitLayer !== undefined) {
    return explicitLayer;
  }
  if (isFrameworkPresentationPath(normalizedPath)) {
    return 'presentation';
  }
  if (matchesPolicyPattern(normalizedPath, policy.compositionEntrypointPatterns)) {
    return 'composition';
  }
  if (matchesPolicyPattern(normalizedPath, policy.sharedContractPatterns)) {
    return 'shared-contracts';
  }
  return undefined;
}

function moduleOf(path) {
  const match = /(?:^|\/)modules\/([^/]+)\/(.+)$/u.exec(path);
  return match === null ? undefined : { name: match[1], innerPath: match[2] };
}

function customViolations(report, allowedDependenciesByLayer, entrypointPolicy) {
  const violations = [];
  for (const module of report.modules) {
    const fromLayer = layerOf(module.source, entrypointPolicy);
    if (isProductionSource(module.source, entrypointPolicy) && fromLayer === undefined) {
      violations.push(
        `${module.source}: production source must belong to an explicit architectural layer, an approved framework entrypoint, an approved composition/bootstrap entrypoint or shared-contracts.`,
      );
    }
    for (const dependency of module.dependencies) {
      const allowedPackages =
        fromLayer === undefined ? undefined : allowedDependenciesByLayer[fromLayer];
      if (allowedPackages !== undefined && !Array.isArray(allowedPackages)) {
        throw new Error(
          `Architecture dependency policy allowlist for ${fromLayer} must be an array`,
        );
      }
      if (
        allowedPackages !== undefined &&
        typeof dependency.module === 'string' &&
        Array.isArray(dependency.dependencyTypes) &&
        dependency.dependencyTypes.some((type) => type.startsWith('npm')) &&
        !isAllowedNpmDependency(dependency.module, allowedPackages)
      ) {
        violations.push(
          `${module.source} imports ${dependency.module}: ${fromLayer} only allows explicitly listed npm dependencies.`,
        );
      }
      if (dependency.resolved === undefined) {
        continue;
      }
      const toLayer = layerOf(dependency.resolved, entrypointPolicy);
      const isFrameworkRouteToApprovedCompositionRoot =
        fromLayer === 'presentation' &&
        toLayer === 'composition' &&
        isFrameworkPresentationPath(module.source) &&
        isApprovedCompositionRoot(dependency.resolved, entrypointPolicy);
      if (
        fromLayer !== undefined &&
        toLayer !== undefined &&
        fromLayer !== toLayer &&
        fromLayer !== 'composition' &&
        !isFrameworkRouteToApprovedCompositionRoot &&
        !ALLOWED_LAYER_EDGES.has(`${fromLayer}:${toLayer}`)
      ) {
        violations.push(
          `${module.source} imports ${dependency.resolved}: ${fromLayer} → ${toLayer} is denied.`,
        );
      }

      const fromModule = moduleOf(module.source);
      const toModule = moduleOf(dependency.resolved);
      if (
        fromModule !== undefined &&
        toModule !== undefined &&
        fromModule.name !== toModule.name &&
        toModule.innerPath.split('/').includes('internal')
      ) {
        violations.push(
          `${module.source} imports ${dependency.resolved}: another module's internal file is denied.`,
        );
      }
    }
  }
  return violations;
}

function runDependencyCruiser(config, targets) {
  const binary = resolve(process.cwd(), 'node_modules/.bin/depcruise');
  if (!existsSync(binary)) {
    throw new Error('dependency-cruiser is not installed; run pnpm install first');
  }
  if (!existsSync(config)) {
    throw new Error(`dependency-cruiser configuration does not exist: ${config}`);
  }
  if (targets.length === 0) {
    return { modules: [], summary: { violations: [] } };
  }

  const result = spawnSync(binary, ['--config', config, '--output-type', 'json', ...targets], {
    encoding: 'utf8',
  });
  if (result.error !== undefined) {
    throw result.error;
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(`dependency-cruiser did not return a JSON report: ${result.stderr.trim()}`);
  }
  if (!Array.isArray(report.modules) || report.summary === undefined) {
    throw new Error('dependency-cruiser returned an invalid report');
  }
  return report;
}

function main() {
  const { config, targets } = parseArguments(process.argv.slice(2));
  const report = runDependencyCruiser(config, targets);
  const allowedDependenciesByLayer = allowedNpmDependencies();
  const entrypointPolicy = architectureEntrypointPolicy();
  const cruiserViolations = report.summary.violations ?? [];
  const violations = [
    ...cruiserViolations.map((violation) => violation.comment),
    ...customViolations(report, allowedDependenciesByLayer, entrypointPolicy),
  ];

  if (violations.length === 0) {
    console.log(`PASS architecture: checked ${report.modules.length} module(s).`);
    return EXIT.pass;
  }
  for (const violation of violations) {
    console.error(`ARCHITECTURE VIOLATION: ${violation}`);
  }
  return EXIT.violation;
}

try {
  process.exit(main());
} catch (error) {
  console.error(
    `CHECKER ERROR architecture: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(EXIT.error);
}
