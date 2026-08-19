import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverWorkspacePackages, EXIT } from '../lib/workspace.mjs';

function optionValue(argv, name, fallback) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  if (argv[index + 1] === undefined) {
    throw new Error(`${name} requires a value`);
  }
  return argv[index + 1];
}

function runPackage(packageInfo, command, root) {
  console.log(
    `[workspace:${command}] ${packageInfo.importerKey} pnpm --dir ${packageInfo.directory} run ${command}`,
  );
  const result = spawnSync('pnpm', ['--dir', packageInfo.directory, 'run', command], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status === null) {
    throw new Error(`${command} terminated by ${result.signal ?? 'unknown signal'}`);
  }
  return result.status;
}

function main() {
  const argv = process.argv.slice(2);
  const root = resolve(process.cwd(), optionValue(argv, '--root', '.'));
  const command = optionValue(argv, '--command', undefined);
  if (command === undefined) {
    throw new Error('--command <package-script> is required');
  }

  const packages = discoverWorkspacePackages(root);
  const missing = packages.filter((packageInfo) => !Object.hasOwn(packageInfo.scripts, command));
  if (missing.length > 0) {
    for (const packageInfo of missing) {
      console.error(
        `WORKSPACE_VIOLATION: ${packageInfo.importerKey} is missing required package script "${command}".`,
      );
    }
    return EXIT.violation;
  }

  if (packages.length === 0) {
    console.log(`PASS workspace ${command}: no workspace packages discovered.`);
    return EXIT.pass;
  }

  for (const packageInfo of packages) {
    const status = runPackage(packageInfo, command, root);
    if (status !== EXIT.pass) {
      return status;
    }
  }

  console.log(`PASS workspace ${command}: ran ${packages.length} package script(s).`);
  return EXIT.pass;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`WORKSPACE_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT.error);
  }
}
