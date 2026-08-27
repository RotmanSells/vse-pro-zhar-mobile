/* global AbortSignal, fetch, setTimeout */
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  accessSync,
  constants,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { URL } from 'node:url';
import { createServer as createProbeServer } from 'node:net';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let apiPort;
let adminPort;
let metroPort;
const ANDROID_PACKAGE = 'com.rotmansells.vseprozhar';
const ANDROID_APK = resolve(ROOT, 'apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk');
const ANDROID_DEV_SERVER_RES_VALUES = resolve(
  ROOT,
  'apps/mobile/android/app/build/generated/res/resValues/debug/values/gradleResValues.xml',
);
const LOG_DIR = resolve(ROOT, 'artifacts/e2e/vpzh-029');
const FIXTURE = {
  categoryName: 'Категория Product details E2E',
  description: 'Сочный шашлык и специи',
  isHit: true,
  isNew: true,
  productName: 'Продукт Product details E2E',
  weightGrams: 350,
};
const services = new Set();
const { Pool } = createRequire(resolve(ROOT, 'apps/api/package.json'))('pg');

function firstExecutable(candidates) {
  return candidates.find((candidate) => candidate !== undefined && existsSync(candidate));
}

function executableOnPath(name) {
  try {
    const path = execFileSync('which', [name], { encoding: 'utf8' }).trim();
    return path === '' ? undefined : path;
  } catch {
    return undefined;
  }
}

function configureToolchain() {
  const sdkRoot =
    process.env.ANDROID_SDK_ROOT ??
    process.env.ANDROID_HOME ??
    '/opt/homebrew/share/android-commandlinetools';
  const javaHome = process.env.JAVA_HOME ?? '/opt/homebrew/opt/openjdk@17';
  const maestroHome =
    process.env.VPZH_MAESTRO_HOME ?? '/Users/rotman/.local/share/vpzh/maestro/2.8.0/maestro';
  const adb = firstExecutable([
    process.env.VPZH_ADB_PATH,
    `${sdkRoot}/platform-tools/adb`,
    '/opt/homebrew/bin/adb',
    executableOnPath('adb'),
  ]);
  const maestro = firstExecutable([
    process.env.VPZH_MAESTRO_PATH,
    `${maestroHome}/bin/maestro`,
    executableOnPath('maestro'),
  ]);
  const java = firstExecutable([
    process.env.VPZH_JAVA_PATH,
    `${javaHome}/bin/java`,
    executableOnPath('java'),
  ]);
  const emulator = firstExecutable([
    process.env.VPZH_EMULATOR_PATH,
    `${sdkRoot}/emulator/emulator`,
    executableOnPath('emulator'),
  ]);
  process.env.ANDROID_SDK_ROOT = sdkRoot;
  process.env.ANDROID_HOME = sdkRoot;
  process.env.JAVA_HOME = javaHome;
  process.env.VPZH_MAESTRO_HOME = maestroHome;
  for (const variable of [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'http_proxy',
    'https_proxy',
    'all_proxy',
  ]) {
    delete process.env[variable];
  }
  process.env.GRADLE_OPTS = [process.env.GRADLE_OPTS, '-Djava.net.preferIPv4Stack=true']
    .filter(Boolean)
    .join(' ');
  process.env.PATH = [
    javaHome + '/bin',
    sdkRoot + '/platform-tools',
    sdkRoot + '/emulator',
    maestroHome + '/bin',
    process.env.PATH,
  ]
    .filter(Boolean)
    .join(':');
  return { adb, emulator, java, maestro };
}

const TOOLCHAIN = configureToolchain();

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createProbeServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to resolve a free local port')));
        return;
      }
      server.close((error) => (error === undefined ? resolvePort(address.port) : reject(error)));
    });
  });
}

function readNativeDevServerConfig() {
  try {
    const values = readFileSync(ANDROID_DEV_SERVER_RES_VALUES, 'utf8');
    const port = values.match(
      /<integer name="react_native_dev_server_port">(\d+)<\/integer>/u,
    )?.[1];
    const host = values.match(
      /<string name="react_native_dev_server_ip"[^>]*>([^<]+)<\/string>/u,
    )?.[1];
    if (port === undefined || host === undefined) return undefined;
    return { host, port: Number(port) };
  } catch {
    return undefined;
  }
}

function apiUrl(path) {
  return `http://127.0.0.1:${apiPort}${path}`;
}

function adminUrl(path) {
  return `http://127.0.0.1:${adminPort}${path}`;
}

class ProductDetailsE2eFailure extends Error {
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

function start(command, args, environment, logName) {
  const log = createWriteStream(resolve(LOG_DIR, logName), { flags: 'w' });
  const child = spawn(command, args, {
    cwd: ROOT,
    detached: process.platform !== 'win32',
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  child.once('close', () => log.end());
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
  throw new ProductDetailsE2eFailure(`${label} was not ready: ${reason}`);
}

async function waitForInstalledApplication(child, timeoutMs = 1_200_000) {
  const deadline = Date.now() + timeoutMs;
  let reason = 'application is not installed';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new ProductDetailsE2eFailure(
        `Mobile build exited before installation (exit ${child.exitCode})`,
        1,
      );
    }
    try {
      if (adb(['shell', 'pm', 'path', ANDROID_PACKAGE]).includes('package:')) return;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
  }
  throw new ProductDetailsE2eFailure(`Android application install was not ready: ${reason}`);
}

async function waitForMetro(child) {
  await eventually(
    'Metro',
    async () => {
      if (child.exitCode !== null) throw new Error(`Metro exited with code ${child.exitCode}`);
      await contains(`http://127.0.0.1:${metroPort}/status`, 'packager-status:running');
    },
    45_000,
  );
}

function connectedEmulator() {
  const devices = adb(['devices'], true);
  const line = devices.split('\n').find((item) => /^emulator-\d+\s+device$/u.test(item.trim()));
  return line?.trim().split(/\s+/u)[0];
}

function availableAvds() {
  if (TOOLCHAIN.emulator === undefined) return [];
  try {
    return execFileSync(TOOLCHAIN.emulator, ['-list-avds'], { encoding: 'utf8' })
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function ensureAndroidReady() {
  const avdName = process.env.VPZH_E2E_AVD ?? 'vpzh-api35';
  let emulatorProcess;
  let serial = connectedEmulator();
  if (serial === undefined) {
    if (TOOLCHAIN.emulator === undefined) {
      throw new ProductDetailsE2eFailure(
        'No Android emulator is connected and the emulator executable was not found',
      );
    }
    if (!availableAvds().includes(avdName)) {
      throw new ProductDetailsE2eFailure(
        `Android AVD "${avdName}" was not found; set VPZH_E2E_AVD to an installed AVD`,
      );
    }
    const emulatorArgs = [
      '-avd',
      avdName,
      '-no-snapshot-load',
      '-no-snapshot-save',
      '-no-window',
      '-noaudio',
      '-no-boot-anim',
      '-gpu',
      'swiftshader_indirect',
    ];
    if (process.env.VPZH_E2E_WIPE_DATA === 'true') emulatorArgs.push('-wipe-data');
    emulatorProcess = start(TOOLCHAIN.emulator, emulatorArgs, {}, 'emulator.log');
  }

  await eventually(
    'Android emulator',
    () => {
      if (emulatorProcess !== undefined && emulatorProcess.exitCode !== null) {
        throw new Error(`emulator exited with code ${emulatorProcess.exitCode}`);
      }
      serial = connectedEmulator();
      if (serial === undefined) throw new Error('emulator is not connected to adb');
      process.env.ANDROID_SERIAL = serial;
      if (adb(['shell', 'getprop', 'sys.boot_completed']).trim() !== '1')
        throw new Error('emulator is still booting');
      if (!adb(['shell', 'pm', 'path', 'android']).includes('package:'))
        throw new Error('Android package manager is not ready');
    },
    300_000,
  );
}

async function contains(url, expected) {
  const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
  if (!response.ok || !(await response.text()).includes(expected)) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
}

async function isolatedDatabase() {
  const raw = process.env.VPZH_TEST_DATABASE_URL;
  if (raw === undefined) throw new ProductDetailsE2eFailure('VPZH_TEST_DATABASE_URL is not set');
  const base = new URL(raw);
  if (!['127.0.0.1', 'localhost'].includes(base.hostname) || base.pathname !== '/vpzh_test') {
    throw new ProductDetailsE2eFailure('VPZH_TEST_DATABASE_URL must be a local vpzh_test database');
  }
  const schema = `vpzh_product_details_${randomUUID().replaceAll('-', '')}`;
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
    async assertDetails(productId) {
      const { rows } = await pool.query(
        `SELECT p.name, p.description, p.weight_grams, p.is_new, p.is_hit,
                p.base_price_minor, p.admin_enabled, c.name AS category_name
         FROM products AS p
         INNER JOIN categories AS c ON c.id = p.category_id
         WHERE p.id = $1`,
        [productId],
      );
      const row = rows[0];
      if (
        row?.name !== FIXTURE.productName ||
        row?.description !== FIXTURE.description ||
        row?.weight_grams !== FIXTURE.weightGrams ||
        row?.is_new !== FIXTURE.isNew ||
        row?.is_hit !== FIXTURE.isHit ||
        row?.base_price_minor !== 45_000 ||
        row?.admin_enabled !== true ||
        row?.category_name !== FIXTURE.categoryName
      ) {
        throw new ProductDetailsE2eFailure('Product details persistence is invalid', 1);
      }
    },
  };
}

function adb(args, allowFailure = false) {
  try {
    if (TOOLCHAIN.adb === undefined) throw new Error('adb was not found');
    return execFileSync(TOOLCHAIN.adb, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (allowFailure) return String(error?.stdout ?? '');
    throw new ProductDetailsE2eFailure(`adb ${args.join(' ')} failed`, 1);
  }
}

async function adminPost(path, body) {
  const response = await fetch(apiUrl(path), {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-vpzh-development-admin-identity': 'admin' },
    method: 'POST',
    signal: AbortSignal.timeout(3_000),
  });
  return { body: await response.json(), response };
}

async function adminPatch(path, body) {
  const response = await fetch(apiUrl(path), {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-vpzh-development-admin-identity': 'admin' },
    method: 'PATCH',
    signal: AbortSignal.timeout(3_000),
  });
  return { body: await response.json(), response };
}

async function seedCatalog() {
  const categoryResult = await adminPost('/admin/categories', { name: FIXTURE.categoryName });
  if (categoryResult.response.status !== 201)
    throw new ProductDetailsE2eFailure('Category setup failed', 1);
  const productResult = await adminPost('/admin/products', {
    adminEnabled: true,
    basePriceMinor: 45_000,
    categoryId: categoryResult.body.id,
    name: FIXTURE.productName,
  });
  if (productResult.response.status !== 201)
    throw new ProductDetailsE2eFailure('Product setup failed', 1);
  const updateResult = await adminPatch(`/admin/products/${productResult.body.id}/details`, {
    description: FIXTURE.description,
    isHit: FIXTURE.isHit,
    isNew: FIXTURE.isNew,
    weightGrams: FIXTURE.weightGrams,
  });
  if (updateResult.response.status !== 200)
    throw new ProductDetailsE2eFailure('Product details update failed', 1);
  return productResult.body.id;
}

async function execute() {
  mkdirSync(LOG_DIR, { recursive: true });
  for (const [name, tool] of Object.entries(TOOLCHAIN)) {
    if (tool === undefined)
      throw new ProductDetailsE2eFailure(`Missing required Android tool: ${name}`);
    try {
      if (name === 'emulator') accessSync(tool, constants.X_OK);
      else execFileSync(tool, ['--version'], { stdio: 'ignore' });
    } catch {
      throw new ProductDetailsE2eFailure(`Required Android tool is not executable: ${name}`);
    }
  }
  await ensureAndroidReady();
  const nativeProjectExists = existsSync(resolve(ROOT, 'apps/mobile/android/gradlew'));
  const cleanNativeProject = process.env.VPZH_E2E_CLEAN_ANDROID === 'true';
  const forceNativeBuild = process.env.VPZH_E2E_BUILD_ANDROID === 'true' || cleanNativeProject;
  const nativeDevServer =
    !forceNativeBuild && existsSync(ANDROID_APK) ? readNativeDevServerConfig() : undefined;
  apiPort = Number(process.env.VPZH_E2E_API_PORT ?? (await findFreePort()));
  adminPort = Number(process.env.VPZH_E2E_ADMIN_PORT ?? (await findFreePort()));
  if (apiPort === adminPort) adminPort = await findFreePort();
  metroPort = Number(
    process.env.VPZH_E2E_METRO_PORT ?? nativeDevServer?.port ?? (await findFreePort()),
  );
  const database = await isolatedDatabase();
  run('pnpm', ['--dir', 'apps/api', 'migrate'], { DATABASE_URL: database.connectionString });
  run('pnpm', ['--dir', 'apps/admin', 'build'], {
    VPZH_ADMIN_API_BASE_URL: apiUrl(''),
  });
  start(
    'pnpm',
    ['--dir', 'apps/api', 'start'],
    {
      DATABASE_URL: database.connectionString,
      HOST: '0.0.0.0',
      NODE_ENV: 'test',
      PORT: String(apiPort),
      VPZH_ENABLE_DEVELOPMENT_ADMIN_IDENTITY: 'true',
    },
    'api.log',
  );
  start(
    'pnpm',
    ['--dir', 'apps/admin', 'start'],
    {
      HOSTNAME: '127.0.0.1',
      PORT: String(adminPort),
      VPZH_ADMIN_API_BASE_URL: apiUrl(''),
    },
    'admin.log',
  );
  await eventually('API', () => contains(apiUrl('/health'), 'vse-pro-zhar-api'), 45_000);
  await eventually('Admin', () => contains(adminUrl('/menu'), 'Создать товар'), 45_000);
  const productId = await seedCatalog();
  await eventually('Admin Product details form', () =>
    contains(adminUrl('/menu'), 'Сохранить детали'),
  );
  await database.assertDetails(productId);
  if (adb(['shell', 'pm', 'path', ANDROID_PACKAGE], true).includes('package:'))
    adb(['uninstall', ANDROID_PACKAGE]);
  if (!nativeProjectExists || cleanNativeProject) {
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
  }
  const mobileEnvironment = {
    EXPO_PUBLIC_API_URL: `http://10.0.2.2:${apiPort}`,
    REACT_NATIVE_PACKAGER_HOSTNAME:
      process.env.VPZH_E2E_METRO_HOST ?? nativeDevServer?.host ?? '10.0.2.2',
  };
  let mobile;
  if (forceNativeBuild || !existsSync(ANDROID_APK)) {
    mobile = start(
      'pnpm',
      ['--dir', 'apps/mobile', 'exec', 'expo', 'run:android', '--port', String(metroPort)],
      mobileEnvironment,
      'mobile.log',
    );
    await waitForInstalledApplication(mobile);
  } else {
    mobile = start(
      'pnpm',
      [
        '--dir',
        'apps/mobile',
        'exec',
        'expo',
        'start',
        '--dev-client',
        '--lan',
        '--port',
        String(metroPort),
      ],
      mobileEnvironment,
      'mobile.log',
    );
    if (!adb(['shell', 'pm', 'path', ANDROID_PACKAGE], true).includes('package:'))
      run(TOOLCHAIN.adb, ['install', '-r', ANDROID_APK]);
  }
  await waitForMetro(mobile);
  try {
    run(TOOLCHAIN.maestro, ['test', '.maestro/product-details.yaml', '--debug-output', LOG_DIR]);
  } catch {
    throw new ProductDetailsE2eFailure('Focused Product details Maestro flow failed', 1);
  }
  await database.assertDetails(productId);
  if (mobile.exitCode !== null && mobile.exitCode !== 0)
    throw new ProductDetailsE2eFailure('Mobile process exited unexpectedly', 1);
}

execute()
  .then(async () => {
    await cleanup();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(`VPZH_029_E2E_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error(
        `VPZH_029_E2E_CLEANUP_ERROR: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
      );
    }
    process.exit(error instanceof ProductDetailsE2eFailure ? error.exitCode : 2);
  });
