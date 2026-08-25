/* global AbortSignal, clearTimeout, fetch, setTimeout */

import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';

const ROOT = process.cwd();
const API = { host: '0.0.0.0', port: 3100 };
const ADMIN = { host: '127.0.0.1', port: 3101 };
const ANDROID_PACKAGE = 'com.rotmansells.vseprozhar';
const CATEGORY_NAME = 'Категория E2E';
const LOG_DIR = resolve(ROOT, 'artifacts/e2e/vpzh-027');
const services = new Set();
const requireFromApi = createRequire(resolve(ROOT, 'apps/api/package.json'));
const { Pool } = requireFromApi('pg');

class CategoryE2eFailure extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}

function toolExists(name) {
  try {
    execFileSync(name, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function logPath(name) {
  return resolve(LOG_DIR, `${name}.log`);
}

function record(path, value) {
  appendFileSync(path, value);
}

function service(command, args, name, environment) {
  const outputPath = logPath(name);
  writeFileSync(outputPath, '');
  const child = spawn(command, args, {
    cwd: ROOT,
    detached: process.platform !== 'win32',
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => record(outputPath, String(chunk)));
  child.stderr.on('data', (chunk) => record(outputPath, String(chunk)));
  services.add(child);
  return child;
}

function command(commandName, args, name, environment = {}, timeoutMs = 120_000) {
  const outputPath = logPath(name);
  writeFileSync(outputPath, '');
  return new Promise((resolveCommand) => {
    const child = spawn(commandName, args, {
      cwd: ROOT,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const collect = (chunk) => {
      const text = String(chunk);
      output += text;
      record(outputPath, text);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolveCommand({ code: 124, output });
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      resolveCommand({ code: 2, output: `${output}${error.message}` });
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolveCommand({ code: code ?? 2, output });
    });
  });
}

async function requireSuccess(commandName, args, name, environment, timeoutMs) {
  const result = await command(commandName, args, name, environment, timeoutMs);
  if (result.code !== 0) {
    throw new CategoryE2eFailure(
      `${commandName} ${args.join(' ')} failed with ${result.code}`,
      result.code === 1 ? 1 : 2,
    );
  }
  return result.output;
}

async function stop(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolveStop) => {
    child.once('exit', resolveStop);
    try {
      if (process.platform !== 'win32' && child.pid !== undefined)
        process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch (error) {
      if (error.code === 'ESRCH') resolveStop();
      else throw error;
    }
    setTimeout(resolveStop, 5_000);
  });
}

async function shutdown() {
  await Promise.all([...services].reverse().map((child) => stop(child)));
  services.clear();
  if (shutdown.database !== undefined) {
    const databaseCleanup = shutdown.database;
    shutdown.database = undefined;
    await databaseCleanup();
  }
}

async function eventually(label, action, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let reason = 'no attempt';
  while (Date.now() < deadline) {
    for (const child of services) {
      if (child.exitCode !== null) throw new CategoryE2eFailure(`${label} process exited`, 1);
    }
    try {
      await action();
      return;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw new CategoryE2eFailure(`${label} was not ready: ${reason}`);
}

async function httpContains(url, text) {
  const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
  const body = await response.text();
  if (!response.ok || !body.includes(text)) throw new Error(`HTTP ${response.status} from ${url}`);
}

function databaseUrl() {
  const raw = process.env.VPZH_TEST_DATABASE_URL;
  if (raw === undefined) throw new CategoryE2eFailure('VPZH_TEST_DATABASE_URL is not set');
  const parsed = new URL(raw);
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.pathname !== '/vpzh_test') {
    throw new CategoryE2eFailure('VPZH_TEST_DATABASE_URL must be a local vpzh_test database');
  }
  return raw;
}

async function isolatedDatabase() {
  const baseUrl = databaseUrl();
  const schema = `vpzh_category_${randomUUID().replaceAll('-', '')}`;
  const adminPool = new Pool({ connectionString: baseUrl, connectionTimeoutMillis: 3_000 });
  await adminPool.query(`CREATE SCHEMA "${schema}"`);
  const scoped = new URL(baseUrl);
  scoped.searchParams.set('options', `-c search_path=${schema},public`);
  const categoryPool = new Pool({
    connectionString: scoped.toString(),
    connectionTimeoutMillis: 3_000,
    query_timeout: 5_000,
  });
  shutdown.database = async () => {
    await categoryPool.end();
    try {
      await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await adminPool.end();
    }
  };
  return {
    connectionString: scoped.toString(),
    async assertCategory() {
      const result = await categoryPool.query('SELECT id, name FROM categories WHERE name = $1', [
        CATEGORY_NAME,
      ]);
      if (result.rows.length !== 1 || result.rows[0]?.name !== CATEGORY_NAME) {
        throw new CategoryE2eFailure('Category is not persisted in the isolated schema', 1);
      }
    },
  };
}

async function adb(args, name, allowFailure = false) {
  const result = await command('adb', args, name, {}, 120_000);
  if (result.code !== 0 && !allowFailure) {
    throw new CategoryE2eFailure(`adb ${args.join(' ')} failed with ${result.code}`, 1);
  }
  return result;
}

async function cleanAndroidInstall() {
  const installed = await adb(['shell', 'pm', 'path', ANDROID_PACKAGE], 'adb-package-check', true);
  if (installed.code === 0 && installed.output.includes('package:')) {
    const removed = await adb(['uninstall', ANDROID_PACKAGE], 'adb-uninstall');
    if (!removed.output.includes('Success'))
      throw new CategoryE2eFailure('Android uninstall failed', 1);
  }
}

async function mutateCategory() {
  const response = await fetch(`http://127.0.0.1:${API.port}/admin/categories`, {
    body: JSON.stringify({ name: CATEGORY_NAME }),
    headers: {
      'content-type': 'application/json',
      'x-vpzh-development-admin-identity': 'admin',
    },
    method: 'POST',
    signal: AbortSignal.timeout(3_000),
  });
  const payload = await response.json();
  if (
    response.status !== 201 ||
    payload?.name !== CATEGORY_NAME ||
    typeof payload?.id !== 'string'
  ) {
    throw new CategoryE2eFailure(`Admin mutation returned HTTP ${response.status}`, 1);
  }
}

async function execute() {
  mkdirSync(LOG_DIR, { recursive: true });
  for (const required of ['adb', 'maestro', 'java']) {
    if (!toolExists(required))
      throw new CategoryE2eFailure(`Missing required Android tool: ${required}`);
  }
  const database = await isolatedDatabase();
  await requireSuccess(
    'pnpm',
    ['--dir', 'apps/api', 'migrate'],
    'migrate',
    {
      DATABASE_URL: database.connectionString,
    },
    90_000,
  );
  await requireSuccess(
    'pnpm',
    ['--dir', 'apps/admin', 'build'],
    'admin-build',
    {
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API.port}`,
    },
    180_000,
  );

  service('pnpm', ['--dir', 'apps/api', 'start'], 'api', {
    DATABASE_URL: database.connectionString,
    HOST: API.host,
    NODE_ENV: 'test',
    PORT: String(API.port),
    VPZH_ENABLE_DEVELOPMENT_ADMIN_IDENTITY: 'true',
  });
  service('pnpm', ['--dir', 'apps/admin', 'start'], 'admin', {
    HOSTNAME: ADMIN.host,
    NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API.port}`,
    PORT: String(ADMIN.port),
  });
  await eventually(
    'API',
    () => httpContains(`http://127.0.0.1:${API.port}/health`, 'vse-pro-zhar-api'),
    45_000,
  );
  await eventually('Admin Category form', () =>
    httpContains(`http://127.0.0.1:${ADMIN.port}/menu`, 'Create Category'),
  );
  await mutateCategory();
  await database.assertCategory();

  await eventually(
    'Android emulator',
    async () => {
      const result = await adb(['shell', 'getprop', 'sys.boot_completed'], 'adb-boot');
      if (result.output.trim() !== '1') throw new Error('sys.boot_completed is not 1');
    },
    120_000,
  );
  await cleanAndroidInstall();
  await requireSuccess(
    'pnpm',
    ['--dir', 'apps/mobile', 'exec', 'expo', 'prebuild', '--platform', 'android', '--clean'],
    'mobile-prebuild',
    {},
    180_000,
  );
  const mobile = service(
    'pnpm',
    ['--dir', 'apps/mobile', 'exec', 'expo', 'run:android'],
    'mobile',
    {
      EXPO_PUBLIC_API_URL: `http://10.0.2.2:${API.port}`,
    },
  );
  await eventually(
    'Android application install',
    async () => {
      if (
        !(await adb(['shell', 'pm', 'path', ANDROID_PACKAGE], 'adb-install')).output.includes(
          'package:',
        )
      ) {
        throw new Error(`${ANDROID_PACKAGE} is not installed`);
      }
    },
    1_200_000,
  );
  const maestro = await command(
    'maestro',
    ['test', '.maestro/category-catalog.yaml', '--debug-output', LOG_DIR],
    'maestro',
    {},
    120_000,
  );
  if (maestro.code !== 0) throw new CategoryE2eFailure('Focused Category Maestro flow failed', 1);
  await database.assertCategory();
  if (mobile.exitCode !== null && mobile.exitCode !== 0) {
    throw new CategoryE2eFailure('Mobile process exited unexpectedly', 1);
  }
}

execute()
  .then(async () => {
    await shutdown();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(`VPZH_027_E2E_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    try {
      await shutdown();
    } catch (cleanupError) {
      console.error(`VPZH_027_E2E_CLEANUP_ERROR: ${String(cleanupError)}`);
    }
    process.exit(error instanceof CategoryE2eFailure ? error.exitCode : 2);
  });
