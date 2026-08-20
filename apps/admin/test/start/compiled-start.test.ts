import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const buildOutput = resolve(projectRoot, 'apps/admin/.next');

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolveWait) => {
    setTimeout(resolveWait, milliseconds);
  });

async function reservePort(): Promise<number> {
  const probe = createServer();
  probe.listen({ host: '127.0.0.1', port: 0 });
  await once(probe, 'listening');

  const address = probe.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Port probe did not receive a TCP address');
  }

  await new Promise<void>((resolveClose, rejectClose) => {
    probe.close((error) => (error === undefined ? resolveClose() : rejectClose(error)));
  });
  return address.port;
}

function sendSignal(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined || process.platform === 'win32') {
    child.kill(signal);
    return;
  }
  process.kill(-child.pid, signal);
}

async function terminate(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;

  const exited = once(child, 'exit');
  try {
    sendSignal(child, 'SIGTERM');
  } catch (error) {
    if (child.exitCode === null) throw error;
    return;
  }

  const exitResult = await Promise.race([exited, wait(5_000)]);
  if (exitResult === undefined && child.exitCode === null) {
    sendSignal(child, 'SIGKILL');
    await exited;
  }
}

async function waitForHome(
  url: string,
  child: ChildProcess,
  output: () => string,
): Promise<Response> {
  let lastFailure: Error | undefined;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`compiled Admin exited before readiness: ${output()}`);
    }
    try {
      return await fetch(url, { signal: AbortSignal.timeout(1_000) });
    } catch (error) {
      if (error instanceof Error) lastFailure = error;
      else throw error;
      await wait(100);
    }
  }
  throw lastFailure ?? new Error(`compiled Admin did not become ready: ${output()}`);
}

await test('compiled Admin starts and renders its shell over real HTTP', async () => {
  rmSync(buildOutput, { force: true, recursive: true });
  let child: ChildProcess | undefined;
  try {
    await run('pnpm', ['--dir', 'apps/admin', 'build'], { cwd: projectRoot });
    const port = await reservePort();
    child = spawn(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['--dir', 'apps/admin', 'start'],
      {
        cwd: projectRoot,
        detached: process.platform !== 'win32',
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let serverOutput = '';
    const recordOutput = (chunk: Buffer): void => {
      serverOutput += chunk.toString();
    };
    child.stdout?.on('data', recordOutput);
    child.stderr?.on('data', recordOutput);

    const response = await waitForHome(`http://127.0.0.1:${port}/`, child, () => serverOutput);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /<h1>Admin<\/h1>/u);
    assert.match(html, /Admin shell is ready\./u);
  } finally {
    if (child !== undefined) await terminate(child);
    rmSync(buildOutput, { force: true, recursive: true });
  }
});
