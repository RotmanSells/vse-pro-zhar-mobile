/* global AbortSignal, fetch, setTimeout */
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';
const ROOT = process.cwd();
const API_PORT = 3100;
const ADMIN_PORT = 3101;
const ANDROID_PACKAGE = 'com.rotmansells.vseprozhar';
const LOG_DIR = resolve(ROOT, 'artifacts/e2e/vpzh-028');
const CATALOG_FIXTURES = [
  { basePriceMinor: 45_000, categoryName: 'Категория A Product E2E', productName: 'Продукт A E2E' },
  { basePriceMinor: 32_500, categoryName: 'Категория B Product E2E', productName: 'Продукт B E2E' },
];
const services = new Set();
const { Pool } = createRequire(resolve(ROOT, 'apps/api/package.json'))('pg');
class ProductE2eFailure extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}
function run(command, args, environment = {}) {
  execFileSync(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...environment },
    stdio: 'inherit',
  });
}
function start(command, args, environment) {
  const child = spawn(command, args, {
    cwd: ROOT,
    detached: process.platform !== 'win32',
    env: { ...process.env, ...environment },
    stdio: 'ignore',
  });
  services.add(child);
  return child;
}
function stop(child) {
  if (child.exitCode !== null) return;
  try {
    if (process.platform !== 'win32' && child.pid !== undefined)
      process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
}
async function cleanup() {
  for (const child of services) stop(child);
  services.clear();
  if (cleanup.database !== undefined) {
    const closeDatabase = cleanup.database;
    cleanup.database = undefined;
    await closeDatabase();
  }
}
async function eventually(label, action, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let reason = 'no attempt';
  while (Date.now() < deadline) {
    try {
      await action();
      return;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw new ProductE2eFailure(`${label} was not ready: ${reason}`);
}
async function contains(url, expected) {
  const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
  if (!response.ok || !(await response.text()).includes(expected))
    throw new Error(`HTTP ${response.status} from ${url}`);
}
async function isolatedDatabase() {
  const raw = process.env.VPZH_TEST_DATABASE_URL;
  if (raw === undefined) throw new ProductE2eFailure('VPZH_TEST_DATABASE_URL is not set');
  const base = new URL(raw);
  if (!['127.0.0.1', 'localhost'].includes(base.hostname) || base.pathname !== '/vpzh_test')
    throw new ProductE2eFailure('VPZH_TEST_DATABASE_URL must be a local vpzh_test database');
  const schema = `vpzh_product_${randomUUID().replaceAll('-', '')}`;
  const adminPool = new Pool({ connectionString: raw, connectionTimeoutMillis: 3_000 });
  await adminPool.query(`CREATE SCHEMA "${schema}"`);
  const scoped = new URL(raw);
  scoped.searchParams.set('options', `-c search_path=${schema},public`);
  const pool = new Pool({
    connectionString: scoped.toString(),
    connectionTimeoutMillis: 3_000,
    query_timeout: 5_000,
  });
  cleanup.database = async () => {
    await pool.end();
    try {
      await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await adminPool.end();
    }
  };
  return {
    connectionString: scoped.toString(),
    async assertProducts() {
      const { rows } = await pool.query(
        `SELECT p.name, p.base_price_minor, p.admin_enabled, c.name AS category_name
         FROM products p JOIN categories c ON c.id = p.category_id WHERE p.name = ANY($1::text[])`,
        [CATALOG_FIXTURES.map(({ productName }) => productName)],
      );
      if (
        rows.length !== CATALOG_FIXTURES.length ||
        CATALOG_FIXTURES.some((fixture) => {
          const row = rows.find(({ name }) => name === fixture.productName);
          return (
            row?.base_price_minor !== fixture.basePriceMinor ||
            row?.admin_enabled !== true ||
            row?.category_name !== fixture.categoryName
          );
        })
      )
        throw new ProductE2eFailure('Product persistence or Category relation is invalid', 1);
    },
  };
}
function adb(args, allowFailure = false) {
  try {
    return execFileSync('adb', args, { encoding: 'utf8' });
  } catch (error) {
    if (allowFailure) return String(error?.stdout ?? '');
    throw new ProductE2eFailure(`adb ${args.join(' ')} failed`, 1);
  }
}
async function adminPost(path, body) {
  const response = await fetch(`http://127.0.0.1:${API_PORT}${path}`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-vpzh-development-admin-identity': 'admin' },
    method: 'POST',
    signal: AbortSignal.timeout(3_000),
  });
  return { body: await response.json(), response };
}
async function seedCatalog() {
  const categoryIds = new Map();
  for (const fixture of CATALOG_FIXTURES) {
    const { body, response } = await adminPost('/admin/categories', { name: fixture.categoryName });
    if (response.status !== 201 || typeof body?.id !== 'string')
      throw new ProductE2eFailure('Category setup failed', 1);
    categoryIds.set(fixture.categoryName, body.id);
  }
  for (const fixture of CATALOG_FIXTURES) {
    const { body, response } = await adminPost('/admin/products', {
      adminEnabled: true,
      basePriceMinor: fixture.basePriceMinor,
      categoryId: categoryIds.get(fixture.categoryName),
      name: fixture.productName,
    });
    if (response.status !== 201 || body?.name !== fixture.productName)
      throw new ProductE2eFailure('Product setup failed', 1);
  }
}
async function execute() {
  mkdirSync(LOG_DIR, { recursive: true });
  for (const tool of ['adb', 'maestro', 'java']) {
    try {
      execFileSync(tool, ['--version'], { stdio: 'ignore' });
    } catch {
      throw new ProductE2eFailure(`Missing required Android tool: ${tool}`);
    }
  }
  const isolated = await isolatedDatabase();
  run('pnpm', ['--dir', 'apps/api', 'migrate'], { DATABASE_URL: isolated.connectionString });
  run('pnpm', ['--dir', 'apps/admin', 'build'], {
    VPZH_ADMIN_API_BASE_URL: `http://127.0.0.1:${API_PORT}`,
  });
  start('pnpm', ['--dir', 'apps/api', 'start'], {
    DATABASE_URL: isolated.connectionString,
    HOST: '0.0.0.0',
    NODE_ENV: 'test',
    PORT: String(API_PORT),
    VPZH_ENABLE_DEVELOPMENT_ADMIN_IDENTITY: 'true',
  });
  start('pnpm', ['--dir', 'apps/admin', 'start'], {
    HOSTNAME: '127.0.0.1',
    PORT: String(ADMIN_PORT),
    VPZH_ADMIN_API_BASE_URL: `http://127.0.0.1:${API_PORT}`,
  });
  await eventually(
    'API',
    () => contains(`http://127.0.0.1:${API_PORT}/health`, 'vse-pro-zhar-api'),
    45_000,
  );
  await eventually('Admin Product form', () =>
    contains(`http://127.0.0.1:${ADMIN_PORT}/menu`, 'Create Product'),
  );
  await seedCatalog();
  await isolated.assertProducts();
  await eventually(
    'Android emulator',
    () => {
      if (adb(['shell', 'getprop', 'sys.boot_completed']).trim() !== '1')
        throw new Error('emulator is not ready');
    },
    120_000,
  );
  if (adb(['shell', 'pm', 'path', ANDROID_PACKAGE], true).includes('package:'))
    adb(['uninstall', ANDROID_PACKAGE]);
  run('pnpm', [
    '--dir',
    'apps/mobile',
    'exec',
    'expo',
    'prebuild',
    '--platform',
    'android',
    '--clean',
  ]);
  const mobile = start('pnpm', ['--dir', 'apps/mobile', 'exec', 'expo', 'run:android'], {
    EXPO_PUBLIC_API_URL: `http://10.0.2.2:${API_PORT}`,
  });
  await eventually(
    'Android application install',
    () => {
      if (!adb(['shell', 'pm', 'path', ANDROID_PACKAGE]).includes('package:'))
        throw new Error('application is not installed');
    },
    1_200_000,
  );
  try {
    run('maestro', ['test', '.maestro/product-catalog.yaml', '--debug-output', LOG_DIR]);
  } catch {
    throw new ProductE2eFailure('Focused Product Maestro flow failed', 1);
  }
  await isolated.assertProducts();
  if (mobile.exitCode !== null && mobile.exitCode !== 0)
    throw new ProductE2eFailure('Mobile process exited unexpectedly', 1);
}
execute()
  .then(async () => {
    await cleanup();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(`VPZH_028_E2E_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error(
        `VPZH_028_E2E_CLEANUP_ERROR: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
      );
    }
    process.exit(error instanceof ProductE2eFailure ? error.exitCode : 2);
  });
