import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };
const LAYERS = new Set(['presentation', 'application', 'domain', 'infrastructure', 'composition']);
const ALLOWED_LAYER_EDGES = new Set([
  'presentation:application',
  'application:domain',
  'infrastructure:application',
  'infrastructure:domain',
]);

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

function layerOf(path) {
  const segments = path.split('/').map((segment) => segment.toLowerCase());
  return segments.find((segment) => LAYERS.has(segment));
}

function moduleOf(path) {
  const match = /(?:^|\/)modules\/([^/]+)\/(.+)$/u.exec(path);
  return match === null ? undefined : { name: match[1], innerPath: match[2] };
}

function customViolations(report) {
  const violations = [];
  for (const module of report.modules) {
    const fromLayer = layerOf(module.source);
    for (const dependency of module.dependencies) {
      if (dependency.resolved === undefined) {
        continue;
      }
      const toLayer = layerOf(dependency.resolved);
      if (
        fromLayer !== undefined &&
        toLayer !== undefined &&
        fromLayer !== toLayer &&
        fromLayer !== 'composition' &&
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
  const cruiserViolations = report.summary.violations ?? [];
  const violations = [
    ...cruiserViolations.map((violation) => violation.comment),
    ...customViolations(report),
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
