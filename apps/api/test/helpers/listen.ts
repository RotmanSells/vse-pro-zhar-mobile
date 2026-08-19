import type { Server } from 'node:http';
export async function listenOnEphemeralPort(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const errorListener = (error: Error): void => {
      server.off('listening', listeningListener);
      reject(error);
    };
    const listeningListener = (): void => {
      server.off('error', errorListener);
      resolve();
    };

    server.once('error', errorListener);
    server.once('listening', listeningListener);
    server.listen(0, '127.0.0.1');
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Ephemeral API server did not expose a TCP address');
  }

  return address.port;
}

export async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }

      reject(error);
    });
  });
}
