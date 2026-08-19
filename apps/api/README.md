# API shell

The M1 API exposes only the operational `GET /health` capability. It is assembled in
`src/composition/create-api-server.ts` and has no PostgreSQL, migration, provider or
business-data dependency.

```text
pnpm --filter @vse-pro-zhar/api dev
```

The default listener is `http://127.0.0.1:3000`. `HOST` and `PORT` are validated at the
runtime-information boundary by `src/infrastructure/runtime-config.ts`.

The machine-readable OpenAPI contract is `openapi/health.openapi.json`.
