import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { HealthResponseSchema } from '@vse-pro-zhar/contracts';

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const apiDist = resolve(repoRoot, 'apps/api/dist');
const contractsDist = resolve(repoRoot, 'packages/contracts/dist');
const rootDist = resolve(repoRoot, 'dist');

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });

function removeDistArtifacts(): void {
  for (const directory of [apiDist, contractsDist, rootDist]) {
    rmSync(directory, { force: true, recursive: true });
  }
}

async function getFreePort(): Promise<number> {
  const server = createServer();

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      resolveListen();
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Free port probe did not expose a TCP address');
  }

  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error === undefined) {
        resolveClose();
        return;
      }

      rejectClose(error);
    });
  });

  return address.port;
}

function signalProcess(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined || process.platform === 'win32') {
    child.kill(signal);
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolveExit) => {
    let finished = false;
    const finish = (): void => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(forceTimer);
      resolveExit();
    };
    const forceTimer = setTimeout(() => {
      signalProcess(child, 'SIGKILL');
      finish();
    }, 5_000);

    child.once('exit', finish);
    signalProcess(child, 'SIGTERM');

    if (child.exitCode !== null) {
      finish();
    }
  });
}

await test('compiled API starts over real HTTP after a clean build', async () => {
  removeDistArtifacts();

  await execFileAsync('pnpm', ['--filter', '@vse-pro-zhar/api', 'build'], {
    cwd: repoRoot,
  });

  assert.equal(existsSync(resolve(apiDist, 'main.js')), true);
  assert.equal(existsSync(resolve(contractsDist, 'index.js')), false);

  const port = await getFreePort();
  const child = spawn(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['--filter', '@vse-pro-zhar/api', 'start'],
    {
      cwd: repoRoot,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let output = '';
  const appendOutput = (chunk: Buffer): void => {
    output += chunk.toString();
  };
  child.stdout?.on('data', appendOutput);
  child.stderr?.on('data', appendOutput);

  try {
    const url = `http://127.0.0.1:${port}/health`;
    const deadline = Date.now() + 15_000;
    let response: Response | undefined;
    let lastError: Error | undefined;

    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`compiled API exited before readiness: ${output}`);
      }

      try {
        response = await fetch(url);
        break;
      } catch (error) {
        if (error instanceof Error) {
          lastError = error;
        } else {
          throw error;
        }
      }

      await delay(100);
    }

    if (response === undefined) {
      throw lastError ?? new Error(`compiled API did not become ready: ${output}`);
    }

    const raw: unknown = JSON.parse(await response.text());
    const body = HealthResponseSchema.parse(raw);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'vse-pro-zhar-api');
    assert.equal(existsSync(resolve(contractsDist, 'index.js')), true);
    assert.match(output, new RegExp(`API listening on 127\\.0\\.0\\.1:${port}`, 'u'));
  } finally {
    await stopProcess(child);
  }
});
