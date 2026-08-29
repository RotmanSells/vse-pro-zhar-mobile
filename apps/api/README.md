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
exist. Product details are updated with `PATCH /admin/products/:id/details`; this endpoint
changes only the nullable 500-character `description`, optional positive integer
`weightGrams`, and separate `isNew`/`isHit` booleans. Guest catalog reads use
`GET /products`, while `GET /products/:id` returns one visible Product with its Category
name and Backend-confirmed details. Hidden or unknown Products return the same safe 404.
`adminEnabled` remains catalog visibility only and is not an iiko availability or
orderability signal. Authenticated Admin reads use `GET /admin/products` and include hidden
Products; `PATCH /admin/products/:id/visibility` changes only this flag and preserves the row.
Category reads use `GET /categories` and Admin Category creation remains `POST /admin/categories`.

The API composition is `Presentation → Application → Domain`, with the PostgreSQL
repository in Infrastructure. PostgreSQL is the sole catalog authority for Categories,
Products, names, prices, approved details, labels, images and `admin_enabled`; iiko is
reserved for future operational availability and kitchen ownership. The migrations are
`migrations/001_create_customers.sql`, `migrations/002_create_customer_legal_acceptances.sql`,
`migrations/003_create_categories.sql`, `migrations/004_create_products.sql`,
`migrations/005_add_product_details.sql`, `migrations/006_add_product_image.sql` and
`migrations/007_enforce_product_image.sql`; apply them with `DATABASE_URL=... pnpm migrate` from
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

VPZH-030 adds the accepted ADR-004 Product imagery boundary. `POST /v2/admin/products` accepts
the four Product fields plus one multipart `image`; `PUT /v2/admin/products/:id/image` replaces
it. The API validates JPEG/PNG/WebP with Sharp, stores only WebP in the configured private
Yandex Object Storage adapter (temporary storage is used only by test runtimes), and persists
an opaque `image_revision`. `GET /v2/products` and `GET /v2/products/:id` return the additive
`imageUrl`; v1 reads remain unchanged. `GET /products/:id/image/:revision` checks visibility and
the current revision before streaming WebP with ETag revalidation. Legacy JSON Product writes
are available only while the 006 expand window is explicitly unfrozen and return
`LEGACY_ENDPOINT_DISABLED` after write freeze.

The machine-readable OpenAPI contract is `openapi/health.openapi.json`.

The API has no mock catalog, demo Product/order records or hardcoded fallback data. When a
Backend/provider capability is not implemented, its owning UI surface must expose an explicit
safe empty/error/placeholder state rather than inventing runtime data.

Legal acceptance exposes only the required `privacy_policy` and `user_agreement` state with
explicitly test-only metadata/versions. It includes no production legal text/version,
marketing consent or repeat-consent policy.
