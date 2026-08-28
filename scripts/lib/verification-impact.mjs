const WORKSPACE_DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

const GLOBAL_PACKAGE_IMPACT_PATHS = new Set([
  '.prettierrc',
  '.prettierrc.cjs',
  '.prettierrc.js',
  '.prettierrc.json',
  '.prettierrc.mjs',
  'eslint.config.cjs',
  'eslint.config.js',
  'eslint.config.mjs',
  'jest.config.cjs',
  'jest.config.js',
  'jest.config.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.build.json',
  'tsconfig.json',
]);

function packageKey(packageInfo) {
  return packageInfo.name ?? packageInfo.importerKey;
}

function workspaceDependencyNames(packageInfo) {
  const names = new Set();
  for (const field of WORKSPACE_DEPENDENCY_FIELDS) {
    const dependencies = packageInfo.manifest?.[field];
    if (dependencies === null || typeof dependencies !== 'object' || Array.isArray(dependencies))
      continue;
    for (const [name, range] of Object.entries(dependencies)) {
      if (typeof range === 'string' && range.startsWith('workspace:')) names.add(name);
    }
  }
  return names;
}

function hasGlobalPackageImpact(path) {
  return (
    GLOBAL_PACKAGE_IMPACT_PATHS.has(path) ||
    path.endsWith('/package.json') ||
    path.startsWith('scripts/lib/') ||
    /^tsconfig\.[^/]+\.json$/u.test(path)
  );
}

export function isDocsOnlyPath(path) {
  return path.startsWith('docs/') || path.endsWith('.md') || path.endsWith('.mdx');
}

export function isDocsOnlyChange(paths) {
  return paths.length > 0 && paths.every(isDocsOnlyPath);
}

export function impactedWorkspacePackages(paths, packages) {
  if (paths.some(hasGlobalPackageImpact)) return packages;

  const impactedKeys = new Set(
    packages
      .filter((packageInfo) =>
        paths.some(
          (path) =>
            path === packageInfo.importerKey ||
            (path.startsWith(`${packageInfo.importerKey}/`) &&
              /\.(?:cjs|css|js|json|mjs|sql|ts|tsx|yaml|yml)$/u.test(path)),
        ),
      )
      .map(packageKey),
  );

  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const packageInfo of packages) {
      const key = packageKey(packageInfo);
      if (impactedKeys.has(key)) continue;
      if ([...workspaceDependencyNames(packageInfo)].some((name) => impactedKeys.has(name))) {
        impactedKeys.add(key);
        expanded = true;
      }
    }
  }

  return packages.filter((packageInfo) => impactedKeys.has(packageKey(packageInfo)));
}
