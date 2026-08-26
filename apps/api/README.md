# API

The API exposes the operational `GET /health` capability, the persisted Category/Product
catalog slices, the VPZH-017 persisted customer profile slice and the VPZH-021 test-only
legal-acceptance slice. The profile path is
`GET/PATCH /me/profile`; legal acceptance uses `GET/POST /me/legal-acceptances`. Both accept only the
explicit `X-VPZH-Development-Identity` header in an opt-in development/test runtime. This
header is not production authentication and is rejected when `NODE_ENV=production`.

Product creation is `POST /admin/products` through the ADR-003 development/test Admin
boundary. Its request requires `categoryId`, `name`, positive integer `basePriceMinor`
(RUB kopecks) and an explicit boolean `adminEnabled`; the selected Category must already
exist. Guest catalog reads use `GET /products`, which returns only persisted
`adminEnabled` Products. This visibility flag is not an iiko availability or orderability
signal. Category reads use `GET /categories` and Admin Category creation remains
`POST /admin/categories`.

The API composition is `Presentation → Application → Domain`, with the PostgreSQL
repository in Infrastructure. The migrations are `migrations/001_create_customers.sql`,
`migrations/002_create_customer_legal_acceptances.sql`, `migrations/003_create_categories.sql`
and `migrations/004_create_products.sql`; apply them with `DATABASE_URL=... pnpm migrate` from
this package directory before using the profile endpoint.

```text
pnpm --filter @vse-pro-zhar/api dev
```

The default listener is `http://127.0.0.1:3000`. `HOST` and `PORT` are validated at the
runtime-information boundary by `src/infrastructure/runtime-config.ts`.

Development/test configuration is disabled by default. Enable the backend boundary only
with `VPZH_ENABLE_DEVELOPMENT_IDENTITY=true` and a non-production `NODE_ENV`:

```text
DATABASE_URL=postgresql://... NODE_ENV=development \
VPZH_ENABLE_DEVELOPMENT_IDENTITY=true pnpm start
```

`VPZH_TEST_DATABASE_URL` is reserved for isolated PostgreSQL integration/E2E tests and
must never point at production data.

The machine-readable OpenAPI contract is `openapi/health.openapi.json`.

Legal acceptance exposes only the required `privacy_policy` and `user_agreement` state with
explicitly test-only metadata/versions. It includes no production legal text/version,
marketing consent or repeat-consent policy.
