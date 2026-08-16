# API shell

The M1 API exposes only the operational `GET /health` capability. It is assembled
in `src/composition` and has no PostgreSQL, migration, provider or business-data
dependency.

Start it locally with:

```text
pnpm --filter @vse-pro-zhar/api dev
```

The default listener is `http://127.0.0.1:3000`. Set `HOST` and `PORT` only for a
supported local or test environment; an Android emulator must use an address that
is reachable from the emulator rather than assuming its own `localhost`.
