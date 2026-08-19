import { createApiServer } from './composition/create-api-server.ts';
import { loadRuntimeConfig } from './infrastructure/runtime-config.ts';

function main(): void {
  const config = loadRuntimeConfig();
  const server = createApiServer();

  server.on('error', (error) => {
    console.error(`api_server_failed: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(config.port, config.host, () => {
    console.log(`API listening on ${config.host}:${config.port}`);
  });
}

main();
