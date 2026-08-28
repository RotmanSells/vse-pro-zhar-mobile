/* global AbortSignal, Blob, Buffer, FormData, URL, fetch, setTimeout */
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createProbeServer } from 'node:net';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGE = 'com.rotmansells.vseprozhar';
const LOG_DIR = resolve(ROOT, 'artifacts/e2e/vpzh-030');
const APK = resolve(ROOT, 'apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk');
const DEV_SERVER_RES_VALUES = resolve(
  ROOT,
  'apps/mobile/android/app/build/generated/res/resValues/debug/values/gradleResValues.xml',
);
const { Pool } = createRequire(resolve(ROOT, 'apps/api/package.json'))('pg');
const services = new Set();
let apiPort;
let adminPort;
let metroPort;
let databaseCleanup;
let storageDirectoryPath;

const FIXTURE = {
  category: 'Категория Product imagery E2E',
  product: 'Продукт Product imagery E2E',
};
const RED_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const BLUE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

class ProductImageryE2eFailure extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}

function executable(name) {
  try {
    const value = execFileSync('which', [name], { encoding: 'utf8' }).trim();
    return value === '' ? undefined : value;
  } catch {
    return undefined;
  }
}

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createProbeServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address === null || typeof address === 'string') {
        probe.close(() => reject(new Error('Unable to find a free port')));
        return;
      }
      probe.close((error) => (error === undefined ? resolvePort(address.port) : reject(error)));
    });
  });
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

function descendantPids(pid) {
  try {
    const direct = execFileSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' })
      .split('\n')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
    return direct.flatMap((childPid) => [childPid, ...descendantPids(childPid)]);
  } catch {
    return [];
  }
}

function stop(child) {
  if (child.exitCode !== null) return;
  const descendants = descendantPids(child.pid);
  for (const pid of descendants.reverse()) {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
    try {
      process.kill(pid, 'SIGTERM');
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
  }
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
  if (databaseCleanup !== undefined) {
    const cleanupDatabase = databaseCleanup;
    databaseCleanup = undefined;
    await cleanupDatabase();
  }
  if (storageDirectoryPath !== undefined) {
    rmSync(storageDirectoryPath, { force: true, recursive: true });
    storageDirectoryPath = undefined;
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
  throw new ProductImageryE2eFailure(`${label} was not ready: ${reason}`);
}

function apiUrl(path) {
  return `http://127.0.0.1:${apiPort}${path}`;
}

function readNativeDevServerConfig() {
  try {
    const source = readFileSync(DEV_SERVER_RES_VALUES, 'utf8');
    const port = source.match(
      /<integer name="react_native_dev_server_port">(\d+)<\/integer>/u,
    )?.[1];
    const host = source.match(
      /<string name="react_native_dev_server_ip"[^>]*>([^<]+)<\/string>/u,
    )?.[1];
    if (port === undefined || host === undefined) return undefined;
    return { host, port: Number(port) };
  } catch {
    return undefined;
  }
}

function configureNativeDevServer(host, port) {
  const propertiesPath = resolve(ROOT, 'apps/mobile/android/gradle.properties');
  const source = existsSync(propertiesPath) ? readFileSync(propertiesPath, 'utf8') : '';
  const withHost = source.includes('reactNativeDevServerIp=')
    ? source.replace(/^reactNativeDevServerIp=.*$/mu, `reactNativeDevServerIp=${host}`)
    : `${source}\nreactNativeDevServerIp=${host}`;
  const withPort = withHost.includes('reactNativeDevServerPort=')
    ? withHost.replace(/^reactNativeDevServerPort=.*$/mu, `reactNativeDevServerPort=${port}`)
    : `${withHost}\nreactNativeDevServerPort=${port}`;
  writeFileSync(propertiesPath, withPort.endsWith('\n') ? withPort : `${withPort}\n`);
}

function connectedEmulator(adb) {
  return execFileSync(adb, ['devices'], { encoding: 'utf8' })
    .split('\n')
    .find((line) => /^emulator-\d+\s+device$/u.test(line.trim()))
    ?.trim()
    .split(/\s+/u)[0];
}

function availableAvds(emulator) {
  try {
    return execFileSync(emulator, ['-list-avds'], { encoding: 'utf8' })
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function ensureAndroidReady(adb, emulator) {
  let serial = connectedEmulator(adb);
  if (serial === undefined) {
    const avdName = process.env.VPZH_E2E_AVD ?? 'vpzh-api35';
    if (emulator === undefined)
      throw new ProductImageryE2eFailure('Android emulator executable was not found');
    if (!availableAvds(emulator).includes(avdName)) {
      throw new ProductImageryE2eFailure(`Android AVD "${avdName}" was not found`);
    }
    const args = [
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
    if (process.env.VPZH_E2E_WIPE_DATA === 'true') args.push('-wipe-data');
    start(emulator, args, {}, 'emulator.log');
  }
  await eventually(
    'Android emulator',
    () => {
      serial = connectedEmulator(adb);
      if (serial === undefined) throw new Error('emulator is not connected to adb');
      process.env.ANDROID_SERIAL = serial;
      if (
        execFileSync(adb, ['shell', 'getprop', 'sys.boot_completed'], {
          encoding: 'utf8',
        }).trim() !== '1'
      ) {
        throw new Error('emulator is still booting');
      }
      if (
        !execFileSync(adb, ['shell', 'pm', 'path', 'android'], { encoding: 'utf8' }).includes(
          'package:',
        )
      ) {
        throw new Error('Android package manager is not ready');
      }
    },
    300_000,
  );
}

async function isolatedDatabase() {
  const raw = process.env.VPZH_TEST_DATABASE_URL;
  if (raw === undefined) throw new ProductImageryE2eFailure('VPZH_TEST_DATABASE_URL is not set');
  const base = new URL(raw);
  if (!['127.0.0.1', 'localhost'].includes(base.hostname) || base.pathname !== '/vpzh_test') {
    throw new ProductImageryE2eFailure('VPZH_TEST_DATABASE_URL must be a local vpzh_test database');
  }
  const schema = `vpzh_product_imagery_${randomUUID().replaceAll('-', '')}`;
  const adminPool = new Pool({ connectionString: raw, connectionTimeoutMillis: 3_000 });
  await adminPool.query(`CREATE SCHEMA "${schema}"`);
  const scoped = new URL(raw);
  scoped.searchParams.set('options', `-c search_path=${schema},public`);
  const pool = new Pool({
    connectionString: scoped.toString(),
    connectionTimeoutMillis: 3_000,
    query_timeout: 5_000,
  });
  databaseCleanup = async () => {
    await pool.end();
    try {
      await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await adminPool.end();
    }
  };
  return scoped.toString();
}

async function adminCategory() {
  const response = await fetch(apiUrl('/admin/categories'), {
    body: JSON.stringify({ name: FIXTURE.category }),
    headers: { 'content-type': 'application/json', 'x-vpzh-development-admin-identity': 'admin' },
    method: 'POST',
  });
  if (response.status !== 201) throw new ProductImageryE2eFailure('Category setup failed', 1);
  return (await response.json()).id;
}

async function createProduct(categoryId) {
  const form = new FormData();
  form.set('categoryId', categoryId);
  form.set('name', FIXTURE.product);
  form.set('basePriceMinor', '45000');
  form.set('adminEnabled', 'true');
  form.set('image', new Blob([RED_PNG], { type: 'image/png' }), '../../red.png');
  const response = await fetch(apiUrl('/v2/admin/products'), {
    body: form,
    headers: { 'x-vpzh-development-admin-identity': 'admin' },
    method: 'POST',
  });
  if (response.status !== 201) throw new ProductImageryE2eFailure('Product image create failed', 1);
  return await response.json();
}

async function replaceProduct(productId) {
  const form = new FormData();
  form.set('image', new Blob([BLUE_PNG], { type: 'application/octet-stream' }), 'replacement.jpg');
  const response = await fetch(apiUrl(`/v2/admin/products/${productId}/image`), {
    body: form,
    headers: { 'x-vpzh-development-admin-identity': 'admin' },
    method: 'PUT',
  });
  if (response.status !== 200)
    throw new ProductImageryE2eFailure('Product image replacement failed', 1);
  return await response.json();
}

async function updateProductVisibility(productId, adminEnabled) {
  const response = await fetch(apiUrl(`/admin/products/${productId}/visibility`), {
    body: JSON.stringify({ adminEnabled }),
    headers: {
      'content-type': 'application/json',
      'x-vpzh-development-admin-identity': 'admin',
    },
    method: 'PATCH',
  });
  if (response.status !== 200)
    throw new ProductImageryE2eFailure('Product visibility update failed', 1);
  return await response.json();
}

async function publicProducts() {
  const response = await fetch(apiUrl('/v2/products'));
  if (response.status !== 200) throw new ProductImageryE2eFailure('Visible Product list failed', 1);
  return await response.json();
}

async function assertImage(url) {
  const imageUrl = new URL(url);
  imageUrl.hostname = '127.0.0.1';
  imageUrl.port = String(apiPort);
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(3_000) });
  if (response.status !== 200 || response.headers.get('content-type') !== 'image/webp') {
    throw new ProductImageryE2eFailure('Backend image response was not a WebP', 1);
  }
}

async function runMaestro() {
  const maestro = process.env.VPZH_MAESTRO_PATH ?? executable('maestro');
  if (maestro === undefined) throw new ProductImageryE2eFailure('Maestro CLI was not found');
  try {
    execFileSync(maestro, ['test', '.maestro/product-imagery.yaml', '--debug-output', LOG_DIR], {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch {
    throw new ProductImageryE2eFailure('Focused Product imagery Maestro flow failed', 1);
  }
}

async function execute() {
  mkdirSync(LOG_DIR, { recursive: true });
  if (process.env.VPZH_TEST_DATABASE_URL === undefined) {
    throw new ProductImageryE2eFailure('VPZH_TEST_DATABASE_URL is required for imagery E2E');
  }
  const adb = process.env.VPZH_ADB_PATH ?? executable('adb');
  if (adb === undefined) throw new ProductImageryE2eFailure('adb was not found');
  const emulator =
    process.env.VPZH_EMULATOR_PATH ??
    executable('emulator') ??
    '/opt/homebrew/share/android-commandlinetools/emulator/emulator';
  await ensureAndroidReady(adb, emulator);
  apiPort = Number(process.env.VPZH_E2E_API_PORT ?? (await findFreePort()));
  adminPort = Number(process.env.VPZH_E2E_ADMIN_PORT ?? (await findFreePort()));
  const apkExists = existsSync(APK);
  const nativeDevServer =
    !process.env.VPZH_E2E_BUILD_ANDROID && apkExists ? readNativeDevServerConfig() : undefined;
  metroPort = Number(
    process.env.VPZH_E2E_METRO_PORT ?? nativeDevServer?.port ?? (await findFreePort()),
  );
  const connectionString = await isolatedDatabase();
  const storageDirectory = resolve(LOG_DIR, 'objects');
  storageDirectoryPath = storageDirectory;
  run('pnpm', ['--dir', 'apps/api', 'migrate'], { DATABASE_URL: connectionString });
  run('pnpm', ['--dir', 'apps/admin', 'build'], { VPZH_ADMIN_API_BASE_URL: apiUrl('') });
  start(
    'pnpm',
    ['--dir', 'apps/api', 'start'],
    {
      DATABASE_URL: connectionString,
      HOST: '0.0.0.0',
      NODE_ENV: 'test',
      PORT: String(apiPort),
      VPZH_ENABLE_DEVELOPMENT_ADMIN_IDENTITY: 'true',
      VPZH_IMAGE_STORAGE_DIRECTORY: storageDirectory,
      VPZH_IMAGE_STORAGE_DRIVER: 'temporary',
      VPZH_PRODUCT_IMAGE_WRITE_FREEZE: 'true',
      VPZH_PUBLIC_API_BASE_URL: `http://10.0.2.2:${apiPort}`,
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
  await eventually('API', async () => {
    const response = await fetch(apiUrl('/health'));
    if (!response.ok || !(await response.text()).includes('vse-pro-zhar-api'))
      throw new Error('API unavailable');
  });
  await eventually('Admin', async () => {
    const response = await fetch(`http://127.0.0.1:${adminPort}/menu`);
    if (!response.ok || !(await response.text()).includes('Категории и товары из нашего Backend'))
      throw new Error('Admin unavailable');
  });
  const categoryId = await adminCategory();
  const created = await createProduct(categoryId);
  await assertImage(created.imageUrl);
  const replaced = await replaceProduct(created.id);
  if (created.imageUrl === replaced.imageUrl)
    throw new ProductImageryE2eFailure('Image revision did not change', 1);
  const oldResponse = await fetch(new URL(created.imageUrl.replace('10.0.2.2', '127.0.0.1')));
  if (oldResponse.status !== 404)
    throw new ProductImageryE2eFailure('Stale image remained readable', 1);
  await assertImage(replaced.imageUrl);
  const hidden = await updateProductVisibility(created.id, false);
  if (hidden.adminEnabled !== false)
    throw new ProductImageryE2eFailure('Product visibility was not persisted as hidden', 1);
  const hiddenProducts = await publicProducts();
  if (hiddenProducts.some((product) => product.id === created.id))
    throw new ProductImageryE2eFailure('Hidden Product remained in the public catalog', 1);
  const hiddenDetails = await fetch(apiUrl(`/v2/products/${created.id}`));
  if (hiddenDetails.status !== 404)
    throw new ProductImageryE2eFailure('Hidden Product details remained publicly readable', 1);
  const restored = await updateProductVisibility(created.id, true);
  if (restored.adminEnabled !== true)
    throw new ProductImageryE2eFailure('Product visibility was not restored', 1);
  const restoredProducts = await publicProducts();
  if (!restoredProducts.some((product) => product.id === created.id))
    throw new ProductImageryE2eFailure('Restored Product did not return to the public catalog', 1);

  let mobile;
  if (process.env.VPZH_E2E_BUILD_ANDROID === 'true') {
    try {
      if (
        execFileSync(adb, ['shell', 'pm', 'path', PACKAGE], { encoding: 'utf8' }).includes(
          'package:',
        )
      ) {
        execFileSync(adb, ['uninstall', PACKAGE], { stdio: 'ignore' });
      }
    } catch {
      // The package may not exist yet; the install wait below remains authoritative.
    }
  }
  if (!apkExists || process.env.VPZH_E2E_BUILD_ANDROID === 'true') {
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
    configureNativeDevServer('10.0.2.2', metroPort);
    mobile = start(
      'pnpm',
      ['--dir', 'apps/mobile', 'exec', 'expo', 'run:android', '--port', String(metroPort)],
      {
        EXPO_PUBLIC_API_URL: `http://10.0.2.2:${apiPort}`,
        REACT_NATIVE_PACKAGER_HOSTNAME: nativeDevServer?.host ?? '10.0.2.2',
      },
      'mobile.log',
    );
    await eventually(
      'Mobile install',
      () => {
        if (mobile.exitCode !== null) throw new Error('Mobile process exited');
        const result = execFileSync(adb, ['shell', 'pm', 'path', PACKAGE], { encoding: 'utf8' });
        if (!result.includes('package:')) throw new Error('APK is not installed');
      },
      1_200_000,
    );
  } else {
    execFileSync(adb, ['install', '-r', APK], { stdio: 'inherit' });
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
      {
        EXPO_PUBLIC_API_URL: `http://10.0.2.2:${apiPort}`,
        REACT_NATIVE_PACKAGER_HOSTNAME: nativeDevServer?.host ?? '10.0.2.2',
      },
      'mobile.log',
    );
  }
  await eventually(
    'Metro',
    async () => {
      if (mobile.exitCode !== null) throw new Error(`Metro exited with ${mobile.exitCode}`);
      const response = await fetch(`http://127.0.0.1:${metroPort}/status`);
      if (!response.ok || !(await response.text()).includes('packager-status:running'))
        throw new Error('Metro unavailable');
    },
    60_000,
  );
  await runMaestro();
}

execute()
  .then(async () => {
    await cleanup();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(`VPZH_030_E2E_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error(
        `VPZH_030_E2E_CLEANUP_ERROR: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
      );
    }
    process.exit(error instanceof ProductImageryE2eFailure ? error.exitCode : 2);
  });
