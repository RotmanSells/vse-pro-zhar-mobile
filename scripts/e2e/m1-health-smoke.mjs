/* global AbortSignal, fetch, setTimeout */

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const EXIT = { pass: 0, violation: 1, error: 2 };
const API_HOST = '0.0.0.0';
const API_PORT = 3100;
const ADMIN_PORT = 3101;
const APP_ID = 'com.rotmansells.vseprozhar';
const ROOT = process.cwd();
const ARTIFACTS = resolve(ROOT, 'artifacts/e2e');
const CHILDREN = [];

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
  await Promise.all(CHILDREN.reverse().map((child) => terminate(child)));
}

async function run(command, args, timeoutMs) {
  const child = start(command, args, commandOutputName(command, args));
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

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });
  ensurePrerequisites();

  await run('pnpm', ['--filter', '@vse-pro-zhar/contracts', 'build'], 60_000);
  await run('pnpm', ['--dir', 'apps/api', 'build'], 60_000);
  await run('pnpm', ['--dir', 'apps/admin', 'build'], 180_000);

  const api = start('pnpm', ['--dir', 'apps/api', 'start'], 'api', {
    HOST: API_HOST,
    PORT: String(API_PORT),
  });
  const admin = start('pnpm', ['--dir', 'apps/admin', 'start'], 'admin', {
    HOSTNAME: '127.0.0.1',
    PORT: String(ADMIN_PORT),
  });
  await waitFor(
    'API',
    45_000,
    () => httpReady(`http://127.0.0.1:${API_PORT}/health`, 'vse-pro-zhar-api'),
    [api],
  );
  await waitFor(
    'Admin',
    60_000,
    () => httpReady(`http://127.0.0.1:${ADMIN_PORT}/`, 'Admin shell is ready.'),
    [admin],
  );

  await waitFor('Android emulator boot', 120_000, async () => {
    if ((await adb('shell', 'getprop', 'sys.boot_completed')).trim() !== '1') {
      throw new Error('sys.boot_completed is not 1');
    }
  });

  const installedPackage = await adbResult('shell', 'pm', 'path', APP_ID);
  if (installedPackage.code === 0 && installedPackage.output.includes('package:')) {
    const uninstallOutput = await adb('uninstall', APP_ID);
    if (!uninstallOutput.includes('Success')) {
      throw new E2eError(`Could not establish clean ${APP_ID} install state: ${uninstallOutput}`);
    }
  } else if (installedPackage.code !== EXIT.violation) {
    throw new E2eError(`Could not inspect ${APP_ID} install state: ${installedPackage.output}`);
  }
  await run(
    'pnpm',
    ['--dir', 'apps/mobile', 'exec', 'expo', 'prebuild', '--platform', 'android', '--clean'],
    180_000,
  );
  const mobile = start('pnpm', ['--dir', 'apps/mobile', 'exec', 'expo', 'run:android'], 'mobile', {
    EXPO_PUBLIC_API_URL: `http://10.0.2.2:${API_PORT}`,
  });
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

  await run('maestro', ['test', '.maestro/m1-health.yaml', '--debug-output', ARTIFACTS], 120_000);
}

main()
  .then(async () => {
    await cleanup();
    process.exit(EXIT.pass);
  })
  .catch(async (error) => {
    console.error(`M1_E2E_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    await cleanup();
    process.exit(error instanceof E2eError ? error.exitCode : EXIT.error);
  });
