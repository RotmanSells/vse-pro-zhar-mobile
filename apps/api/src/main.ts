import { createApiServer } from './composition/create-api-server';

function configuredPort(value: string | undefined): number {
  if (value === undefined) return 3000;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

const host = process.env.HOST ?? '127.0.0.1';
const port = configuredPort(process.env.PORT);
const server = createApiServer();

server.listen(port, host, () => {
  console.log(`API listening on ${host}:${port}`);
});
