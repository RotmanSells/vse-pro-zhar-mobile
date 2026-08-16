# M1 shell topology

This document defines the implementation topology for VPZH-010. It implements
ADR-001; it does not introduce a new architectural decision.

## Canonical package layout

```text
apps/api/
  src/composition/
  src/presentation/
  src/application/
  src/domain/
  src/infrastructure/
apps/mobile/
  src/composition/
  src/presentation/
  src/application/
  src/infrastructure/
apps/admin/
  src/composition/
  src/presentation/
  src/application/
  src/infrastructure/
packages/contracts/
  src/
contracts/api/health.openapi.yaml
```

The `composition` directory is the only place that assembles concrete adapters.
The architecture checker recognizes `composition` as the composition-root layer.
Presentation does not import infrastructure implementations directly, and Domain
does not import framework, HTTP or provider packages.

## M1 runtime capability

The API exposes `GET /health` according to
[`contracts/api/health.openapi.yaml`](../../contracts/api/health.openapi.yaml).
Mobile uses an API adapter and validates the response with the shared runtime
contract. Admin only proves that its real shell starts; it has no business CRUD.

M1 does not require PostgreSQL, migrations, external providers or persistent data.
The API process may run without a database, and the absence of a database must be
explicit in the milestone verification evidence.

## Local startup and E2E topology

The package READMEs created by VPZH-010 must document these commands:

```text
pnpm --filter @vse-pro-zhar/api dev
pnpm --filter @vse-pro-zhar/mobile start
pnpm --filter @vse-pro-zhar/admin dev
pnpm test:e2e
```

The canonical smoke target is an Android emulator. The API starts first and binds
to an address reachable from the emulator; the mobile app receives `API_BASE_URL`
through the supported Expo configuration. The Maestro flow
`.maestro/m1-health.yaml` then verifies the real API health response. `localhost`
must not be used as the emulator API address unless the test environment explicitly
provides that mapping.

For the final VPZH-014 M1 pull request, `.github/workflows/verify.yml` invokes
`pnpm verify:milestone` instead of the ordinary `pnpm verify:pr`. It supplies the
Android-emulator API address through `API_BASE_URL`; `verify:milestone` first runs
`verify:pr` and then all M1 contract, integration, security, smoke and E2E gates.

The M1 implementation must install Maestro with its official installer, boot an
Android API 34 emulator, start the API and mobile test client, and clean up all
background processes even on failure before `test:e2e` runs. The implementation
must make this setup executable in the workflow rather than only documenting it.
