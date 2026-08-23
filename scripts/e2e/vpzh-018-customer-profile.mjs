/* global AbortSignal, fetch, setTimeout */

import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';

const EXIT = { pass: 0, violation: 1, error: 2 };
const API_HOST = '0.0.0.0';
const API_PORT = 3100;
const APP_ID = 'com.rotmansells.vseprozhar';
const TEST_PHONE = '79180180000';
const ROOT = process.cwd();
const ARTIFACTS = resolve(ROOT, 'artifacts/e2e/vpzh-018');
const CHILDREN = [];
const requireFromApi = createRequire(resolve(ROOT, 'apps/api/package.json'));
const { Pool } = requireFromApi('pg');

let databaseCleanup;

class E2eError extends Error {
  constructor(message, exitCode = EXIT.error) {
    super(message);
    this.exitCode = exitCode;
  }
}

function commandAvailable(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.error === undefined;
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function childOutputPath(name) {
  return resolve(ARTIFACTS, `${name}.log`);
}

function commandOutputName(command, args) {
  return `command-${command}-${args.join('-')}`.replaceAll(/[^a-zA-Z0-9._-]/g, '_');
}

function start(command, args, name, environment = {}) {
  const outputPath = childOutputPath(name);
  writeFileSync(outputPath, '');
  const output = (chunk) => writeFileSync(outputPath, chunk, { flag: 'a' });
  const child = spawn(command, args, {
    cwd: ROOT,
    detached: process.platform !== 'win32',
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', output);
  child.stderr.on('data', output);
  CHILDREN.push(child);
  return child;
}

async function terminate(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
  try {
    if (child.pid !== undefined && process.platform !== 'win32')
      process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  } catch (error) {
    if (error.code === 'ESRCH') return;
    throw error;
  }
  await Promise.race([exited, wait(5_000)]);
  if (child.exitCode === null) {
    try {
      if (child.pid !== undefined && process.platform !== 'win32')
        process.kill(-child.pid, 'SIGKILL');
      else child.kill('SIGKILL');
    } catch (error) {
      if (error.code === 'ESRCH') return;
      throw error;
    }
    await Promise.race([exited, wait(5_000)]);
  }
}

async function cleanup() {
  await Promise.all(
    CHILDREN.splice(0)
      .reverse()
      .map((child) => terminate(child)),
  );
  if (databaseCleanup !== undefined) {
    const cleanup = databaseCleanup;
    databaseCleanup = undefined;
    await cleanup();
  }
}

async function run(command, args, timeoutMs, environment = {}) {
  const child = start(command, args, commandOutputName(command, args), environment);
  const exitCode = await Promise.race([
    new Promise((resolveExit) => child.once('exit', (code) => resolveExit(code ?? EXIT.error))),
    wait(timeoutMs).then(() => 'timeout'),
  ]);
  if (exitCode === 'timeout') {
    await terminate(child);
    throw new E2eError(`${command} ${args.join(' ')} timed out after ${timeoutMs}ms`);
  }
  if (exitCode !== 0) {
    throw new E2eError(`${command} ${args.join(' ')} exited with ${exitCode}`, EXIT.violation);
  }
}

async function waitFor(label, timeoutMs, action, children = []) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    for (const child of children) {
      if (child.exitCode !== null) {
        throw new E2eError(`${label} process exited before readiness`, EXIT.violation);
      }
    }
    try {
      await action();
      return;
    } catch (error) {
      lastError = error;
      await wait(250);
    }
  }
  throw new E2eError(
    `${label} did not become ready within ${timeoutMs}ms: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function httpReady(url, expectedText) {
  const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
  const body = await response.text();
  if (!response.ok || !body.includes(expectedText)) {
    throw new Error(`unexpected ${response.status} response from ${url}`);
  }
}

async function adbResult(...args) {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn('adb', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += String(chunk);
    });
    child.once('error', rejectResult);
    child.once('exit', (code) => {
      resolveResult({ code: code ?? EXIT.error, output });
    });
  });
}

async function adb(...args) {
  const result = await adbResult(...args);
  if (result.code !== 0) {
    throw new Error(`adb ${args.join(' ')} exited with ${result.code}: ${result.output}`);
  }
  return result.output;
}

function ensurePrerequisites() {
  for (const command of ['adb', 'maestro', 'java']) {
    if (!commandAvailable(command)) {
      throw new E2eError(`Missing required Android E2E command: ${command}`);
    }
  }
}

function readTestDatabaseUrl() {
  const value = process.env.VPZH_TEST_DATABASE_URL;
  if (value === undefined) {
    throw new E2eError('VPZH_TEST_DATABASE_URL must identify the isolated test database');
  }

  const parsed = new URL(value);
  if (
    (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') ||
    parsed.pathname !== '/vpzh_test'
  ) {
    throw new E2eError('VPZH_TEST_DATABASE_URL must be a local vpzh_test database');
  }
  return value;
}

async function prepareIsolatedDatabase() {
  const testDatabaseUrl = readTestDatabaseUrl();
  const schema = `vpzh_e2e_${randomUUID().replaceAll('-', '')}`;
  const adminPool = new Pool({
    connectionString: testDatabaseUrl,
    connectionTimeoutMillis: 3_000,
    query_timeout: 5_000,
  });
  try {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
  } catch (error) {
    await adminPool.end();
    throw error;
  }

  const isolatedUrl = new URL(testDatabaseUrl);
  isolatedUrl.searchParams.set('options', `-c search_path=${schema},public`);
  const connectionString = isolatedUrl.toString();
  const profilePool = new Pool({
    connectionString,
    connectionTimeoutMillis: 3_000,
    query_timeout: 5_000,
  });

  databaseCleanup = async () => {
    await profilePool.end();
    try {
      await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await adminPool.end();
    }
  };

  return {
    connectionString,
    async assertPersistedCustomer() {
      const result = await profilePool.query(
        'SELECT phone, name, birthday::text AS birthday FROM customers WHERE phone = $1',
        [TEST_PHONE],
      );
      if (
        result.rows.length !== 1 ||
        result.rows[0]?.phone !== TEST_PHONE ||
        result.rows[0]?.name !== null ||
        result.rows[0]?.birthday !== null
      ) {
        throw new E2eError('Mobile profile flow did not persist the expected test customer');
      }
    },
  };
}

async function ensureCleanInstall() {
  const installedPackage = await adbResult('shell', 'pm', 'path', APP_ID);
  if (installedPackage.code === 0 && installedPackage.output.includes('package:')) {
    const uninstallOutput = await adb('uninstall', APP_ID);
    if (!uninstallOutput.includes('Success')) {
      throw new E2eError(`Could not establish clean ${APP_ID} install state: ${uninstallOutput}`);
    }
  } else if (installedPackage.code !== EXIT.violation) {
    throw new E2eError(`Could not inspect ${APP_ID} install state: ${installedPackage.output}`);
  }
}

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });
  ensurePrerequisites();
  const database = await prepareIsolatedDatabase();

  await run('pnpm', ['--dir', 'apps/api', 'migrate'], 90_000, {
    DATABASE_URL: database.connectionString,
  });

  const api = start('pnpm', ['--dir', 'apps/api', 'start'], 'vpzh-018-api', {
    DATABASE_URL: database.connectionString,
    HOST: API_HOST,
    NODE_ENV: 'test',
    PORT: String(API_PORT),
    VPZH_ENABLE_DEVELOPMENT_IDENTITY: 'true',
  });
  await waitFor(
    'API',
    45_000,
    () => httpReady(`http://127.0.0.1:${API_PORT}/health`, 'vse-pro-zhar-api'),
    [api],
  );

  await waitFor('Android emulator boot', 120_000, async () => {
    if ((await adb('shell', 'getprop', 'sys.boot_completed')).trim() !== '1') {
      throw new Error('sys.boot_completed is not 1');
    }
  });
  await ensureCleanInstall();

  await run(
    'pnpm',
    ['--dir', 'apps/mobile', 'exec', 'expo', 'prebuild', '--platform', 'android', '--clean'],
    180_000,
  );
  const mobile = start(
    'pnpm',
    ['--dir', 'apps/mobile', 'exec', 'expo', 'run:android'],
    'vpzh-018-mobile',
    {
      EXPO_PUBLIC_API_URL: `http://10.0.2.2:${API_PORT}`,
      EXPO_PUBLIC_DEV_AUTH_BYPASS: 'true',
    },
  );
  await waitFor(
    'mobile build and install',
    1_200_000,
    async () => {
      if (!(await adb('shell', 'pm', 'path', APP_ID)).includes('package:')) {
        throw new Error(`${APP_ID} is not installed`);
      }
    },
    [mobile],
  );

  await run(
    'maestro',
    ['test', '.maestro/vpzh-018-customer-profile.yaml', '--debug-output', ARTIFACTS],
    120_000,
  );
  await database.assertPersistedCustomer();
}

main()
  .then(async () => {
    await cleanup();
    process.exit(EXIT.pass);
  })
  .catch(async (error) => {
    console.error(`VPZH_018_E2E_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error(
        `VPZH_018_E2E_CLEANUP_ERROR: ${
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        }`,
      );
    }
    process.exit(error instanceof E2eError ? error.exitCode : EXIT.error);
  });
