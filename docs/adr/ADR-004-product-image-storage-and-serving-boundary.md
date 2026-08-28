# ADR-004: Product image storage and serving boundary

- Status: Accepted
- Date: 2026-08-28
- Scope: VPZH-030 Product imagery; API, PostgreSQL, Admin, Mobile and shared contracts
- Supersedes: none

## Context

The current Product has no image field or image route. Product rows are persisted in
PostgreSQL, `admin_enabled` is the existing catalog-visibility flag, Admin mutations use
the separate development/test boundary from ADR-003, and the current HTTP parser accepts
only small JSON bodies. Product imagery is required to have one main image, to be uploaded
by Admin as a file, and to be available to Guests only for visible Products.

Production must not store image assets on the API server filesystem. The initial product
scale is small, so this decision must not introduce a CDN, a queue, a generic media service,
direct client uploads or a second Product model. The current API has no released production
Admin authentication; VPZH-030 therefore keeps Admin mutation behind ADR-003 in development
and test runtimes and does not invent production Admin authentication.

## Decision

### 1. Provider and storage model

Use **Yandex Object Storage** through its Amazon S3-compatible API.

The deployment default for the production bucket is:

```text
vse-pro-zhar-product-images-prod
```

The bucket name is configuration, not an application invariant. The deployed value is
provided by `VPZH_PRODUCT_IMAGE_BUCKET`; the default above is used only when provisioning
the production environment. The development default is
`vse-pro-zhar-product-images-dev`. Automated tests do not use either provider bucket.

It is a private bucket in the Russia region `ru-central1`, using the standard storage
class. Public object read, public object listing, static website hosting and public bucket
configuration read are disabled. Bucket versioning is disabled because every replacement
uses a new opaque object key; retaining provider object versions would add cost and cleanup
complexity without improving the Product invariant.

The S3 endpoint and signing region are:

```text
endpoint: https://storage.yandexcloud.net
region:   ru-central1
```

Development may use the separate default bucket `vse-pro-zhar-product-images-dev` when a
real provider integration is explicitly needed. Normal development and all automated tests
use an injected local test adapter, never production storage. Unit tests use an in-memory
adapter; integration and Android E2E use an isolated temporary-directory adapter that
survives an API process restart and is deleted during test cleanup.

The API receives this configuration only from its deployment environment:

```text
VPZH_IMAGE_STORAGE_ENDPOINT=https://storage.yandexcloud.net
VPZH_IMAGE_STORAGE_REGION=ru-central1
VPZH_PRODUCT_IMAGE_BUCKET=vse-pro-zhar-product-images-prod
VPZH_IMAGE_STORAGE_ACCESS_KEY_ID=<secret>
VPZH_IMAGE_STORAGE_SECRET_ACCESS_KEY=<secret>
VPZH_IMAGE_STORAGE_REQUEST_TIMEOUT_MS=5000
VPZH_IMAGE_STORAGE_MAX_ATTEMPTS=3
VPZH_PUBLIC_API_BASE_URL=https://api.example.invalid
```

`VPZH_PUBLIC_API_BASE_URL` is the canonical HTTPS API origin used to form absolute
Backend-controlled `imageUrl` values. It is required in production and may be an HTTP local
origin in development/test. It must contain no credentials and no path other than `/`.
Image limits are code constants, not operator-controlled environment values.

The service account has bucket-scoped object read/write/delete access and no mobile or Admin
client receives its credentials. The deployment secret store (Yandex Lockbox or the hosting
platform's equivalent) owns the values. Rotation creates a second key, updates the secret,
rolls the API, verifies a read/write/delete health check in the deployment environment, and
then revokes the old key. Static keys are rotated at least every 90 days. Credentials are
never logged, returned in errors or placed in fixtures.

The only production adapter is `YandexS3ObjectStorage`, implementing the application
`ObjectStorage` port. It performs `PutObject`, `GetObject` and `DeleteObject` with the
AWS SDK for JavaScript v3. The SDK client uses standard bounded retry with
`maxAttempts: 3`; calls also have a 5-second abort timeout. Retry is used only for safe
reads and idempotent writes/deletes to an already chosen unique key. The Product database
mutation is not blindly retried.

The server controls all object keys. For Product UUID `P` and opaque image revision UUID
`R`, the only key shape is:

```text
product-images/P/R.webp
```

`P` and `R` are generated/validated UUIDs; filename, extension, MIME type and request path
are never concatenated into an object key. The transformed WebP is the only stored asset;
the original upload is not retained.

### 2. Serving boundary and public contract

Use a **Backend-controlled image endpoint**. Do not use a public bucket URL and do not issue
signed object-storage URLs to Mobile or Guests.

The canonical serving path is:

```text
GET /products/:productId/image/:imageRevision
```

The Backend verifies, in this order, that the Product exists, is currently
`admin_enabled = true`, and that `imageRevision` equals the current PostgreSQL
`image_revision`. Only then does it call object storage. Unknown Products, hidden Products,
invalid revisions and stale revisions all return the same safe `404 NOT_FOUND`; provider
status, bucket name and object key are not exposed.

The existing v1 `GET /products` and `GET /products/:id` response shapes stay unchanged for
existing clients. New image-aware reads are versioned explicitly:

```text
GET /v2/products
GET /v2/products/:id
```

They return the existing Product fields plus exactly one client-facing field:

```ts
interface ProductWithImageResponse extends ProductResponse {
  readonly imageUrl: string;
}
```

`imageUrl` is an absolute URL formed by the Backend from `VPZH_PUBLIC_API_BASE_URL`, the
Product UUID and the current opaque revision UUID. It is not stored in PostgreSQL and never
contains the object-storage endpoint, bucket or credentials. The URL is stable across
process reloads while the same image remains confirmed. A successful replacement generates
a new revision UUID, so the URL changes and standard URL-based caching is naturally busted.

The Admin create and replacement responses use the same image-aware response. No image
metadata beyond `imageUrl` is exposed to clients.

The image response is:

```text
200 Content-Type: image/webp
    Cache-Control: private, no-cache
    ETag: "<opaque-image-revision>"
304 when If-None-Match matches, after visibility/revision checks
404 for hidden, unknown or stale revisions
503 STORAGE_UNAVAILABLE for a provider timeout or provider failure
```

The response also sets `X-Content-Type-Options: nosniff`. A previously downloaded image may
remain in a device cache after a Product becomes hidden; the server never authorizes a new
request for that hidden Product. Offline authority and cache invalidation beyond this
versioned URL contract belong to later offline work.

This endpoint is intentionally a small media proxy. At the current scale it is the simplest
way to keep the bucket private, enforce Product visibility on every request, avoid provider
URL leakage and keep credentials out of clients. The endpoint streams the object and does
not persist it on API disk.

### 3. Product lifecycle and API compatibility

There is no draft/publication model. After the contract phase, every Product row has an
image and `admin_enabled` keeps its existing meaning: it alone controls catalog visibility;
it is not changed into an implicit publication state and is not an iiko/orderability flag.

New Product creation is one multipart operation:

```text
POST /v2/admin/products
Content-Type: multipart/form-data; boundary=...
fields: categoryId, name, basePriceMinor, adminEnabled, image
```

The `image` part is required and is the only file part. The legacy
`POST /admin/products` JSON create remains available only during the 006 expand window. It is
disabled at the write-freeze boundary and returns `410 LEGACY_ENDPOINT_DISABLED` thereafter;
it is never used to create a Product after 007. The API authenticates and authorizes the
Admin before processing the file. It stores the processed object first and commits the
Product row only after the object exists. If the database commit fails, the new object is
deleted on a bounded best-effort basis and no Product points at it.

Replacement is:

```text
PUT /v2/admin/products/:productId/image
Content-Type: multipart/form-data; boundary=...
field: image
```

There is no `DELETE /admin/products/:id/image`. Replacement creates a new object, then uses
an optimistic compare-and-set update of the Product row. The Product never points to the
new key before its upload succeeds. If the compare-and-set loses a concurrent replacement,
the new object is deleted and the request returns `409 CONFLICT`; the previously confirmed
image remains valid. After a successful commit, the old object is deleted with the same
5-second timeout and bounded idempotent retry. A cleanup failure does not roll back the
confirmed Product; it emits a safe operational error and leaves an inaccessible orphan for
manual cleanup. Orphans cannot be read through the Backend because their revision is no
longer current, and the bucket is private.

The public API error contract adds these stable codes to the existing safe error envelope:

| HTTP | Code                       | Use                                                            |
| ---: | -------------------------- | -------------------------------------------------------------- |
|  400 | `INVALID_REQUEST`          | Missing/duplicate fields or malformed form values              |
|  401 | `AUTHENTICATION_REQUIRED`  | Missing/invalid Admin identity                                 |
|  403 | `FORBIDDEN`                | Authenticated principal lacks the named image permission       |
|  404 | `NOT_FOUND`                | Unknown/hidden Product or stale image revision                 |
|  409 | `CONFLICT`                 | Concurrent replacement lost the compare-and-set                |
|  410 | `LEGACY_ENDPOINT_DISABLED` | Legacy JSON Product creation is disabled after write freeze    |
|  413 | `PAYLOAD_TOO_LARGE`        | Multipart body or file exceeds its limit                       |
|  415 | `UNSUPPORTED_MEDIA_TYPE`   | Unsupported multipart request or file-part media type          |
|  422 | `INVALID_IMAGE`            | Signature, decoder, dimension, animation or conversion failure |
|  503 | `STORAGE_UNAVAILABLE`      | Object-storage timeout or provider failure                     |

All messages are safe and contain no provider, filesystem, SQL, stack-trace or credential
details.

### 4. Database and deployment strategy

The implementation uses two versioned migrations:

```text
006_add_product_image.sql
  ADD COLUMN image_revision UUID NULL

007_enforce_product_image.sql
  ALTER TABLE products ALTER COLUMN image_revision SET NOT NULL
```

No placeholder, invented image and Product deletion is allowed. The data migration between
these schema migrations processes every existing Product through the same validation,
orientation and WebP pipeline, uploads it to the selected environment's object storage and
sets `image_revision`. The source assets are an explicit operator-provided image bundle or Admin
uploads; if any existing Product has no approved source image, the backfill stops and the
contract phase cannot proceed. Existing `admin_enabled` values and all Product fields remain
unchanged.

The rollout is:

```text
006 expand (nullable image_revision)
→ deploy image-aware code while old reads remain compatible
→ freeze Product writes / route them only to the image-aware Admin boundary
→ backfill and verify every existing Product has a confirmed object
→ drain old API/Admin writers
→ 007 contract (NOT NULL)
→ deploy/unfreeze final image-aware writes
```

The old API can coexist with the nullable column only during the expand/backfill window;
its Product reads do not depend on the new column. Old Product writers are frozen before
backfill and before `007`, so a rolling deployment cannot create a new visible row without
an image. `007` is not applied while an old writer can still receive Product mutations.
This satisfies DB-006/DB-007 without changing `admin_enabled` semantics or silently hiding
existing Products.

### 5. Image processing and security

Use `sharp@0.35.4` on the API. It supports the repository's Node `24.14.1` runtime and
ships prebuilt libvips binaries for the Linux/macOS platforms used by development and CI;
no globally installed ImageMagick or libvips is required. The code uses the Buffer API, not
the newer Web Streams path.

The exact processing rules are:

- accept one `image` file part; filename, extension and multipart MIME are untrusted hints and
  may be absent or inaccurate, while the decoder must yield exactly JPEG, PNG or WebP;
- enforce a 10 MiB (`10,485,760` bytes) file limit and a 64 KiB multipart framing/fields
  allowance, so the request-body hard limit is `10,551,296` bytes;
- validate the multipart boundary as RFC 2046-safe and no longer than 70 bytes before
  invoking the parser; configure `@fastify/busboy@3.2.2` for exactly one file, four fields,
  five parts, bounded field/header sizes and `fileSize = 10,485,760`;
- authenticate/authorize and apply a rate limit of 10 image mutations per Admin principal
  per 60 seconds before decoding; allow at most two concurrent image transformations per
  API process;
- use the decoder's content signature and `sharp.metadata()`; filename, extension and client
  MIME are untrusted hints and never acceptance criteria. The decoded format alone must be
  one of JPEG, PNG or WebP;
- reject input above **25,000,000 decoded pixels**, above **10,000 pixels in either
  dimension**, malformed/truncated data, unsupported channels and any animated/multi-frame
  input. Reject APNG `acTL` and animated WebP frame markers during the bounded signature
  check; do not accept the first frame;
- construct Sharp with `limitInputPixels: 25_000_000`, `limitInputChannels: 4`,
  `pages: 1`, `animated: false`, `sequentialRead: true` and `failOn: 'warning'`. The
  metadata probe is checked before a full decode because a compressed byte limit alone is
  not a pixel limit;
- apply EXIF orientation before resizing, then resize with
  `fit: 'inside'`, `width: 1600`, `height: 1600`, `withoutEnlargement: true`. This preserves
  aspect ratio and never crops or pads the image;
- encode as WebP with quality 82, preserve alpha when present, convert to sRGB and strip
  EXIF (including GPS and thumbnails), ICC, XMP, comments and all other source metadata;
- stop processing after 5 seconds using Sharp's processing timeout. Conversion failure is
  `422 INVALID_IMAGE`; it never creates or publishes an object.

The upload route uses a streaming multipart parser and a bounded buffer only after the file
limit is enforced. The parser always consumes/discards the rest of a rejected request, and
all parser errors are handled. File names are treated as untrusted display data and are not
logged or used in storage paths.

### 6. Dependencies

The minimum new API runtime dependencies are:

```text
@aws-sdk/client-s3           — Yandex Object Storage S3 adapter; verify the current stable
                              release when updating the implementation lockfile and pin it exactly
@fastify/busboy@3.2.2       — bounded streaming multipart/form-data parsing
sharp@0.35.4                — signature/metadata probe, orientation, resize and WebP encode
```

No presigner package is added because Guests and Mobile never receive signed storage URLs.
No CDN, multipart-upload client, ORM, queue, filesystem production adapter or generic media
package is added. `pnpm-lock.yaml` must include the platform-specific optional Sharp
packages selected by pnpm; CI must install optional dependencies and must run on a supported
glibc/musl Linux image. This repository currently has no Dockerfile, so no Docker image
change is part of this decision.

## Alternatives considered

### Public Yandex Object Storage URL

Rejected. Public read leaks the provider/bucket boundary, cannot reliably enforce hidden
Product visibility and makes stale/replaced object URLs harder to revoke.

### Signed Yandex Object Storage URL

Rejected for this slice. It would require expiring bearer URLs, direct provider exposure,
additional URL-generation logic and client behavior for expiry. It does not improve the
current low-scale use case enough to justify that complexity.

### Cloudflare R2

Rejected for this project. R2 is technically compatible through an S3 endpoint, but its
documented SDK configuration uses `region: auto` and an account endpoint; it does not fit
the project's explicit `ru-central1` operational/data-location choice as directly as
Yandex Object Storage. The provider remains a viable future migration target because the
application port is provider-neutral.

### Amazon S3

Rejected for this slice. S3 is mature and compatible with the selected SDK, but selecting a
separate AWS account/region and its operational boundary adds provider and deployment work
without a requirement at the current scale.

### Local API disk

Rejected for production. It fails the approved production object-storage requirement and is
not durable across API replacement or horizontal scaling.

### Separate media service, CDN or queue

Rejected under CORE-001. One Product-owned application boundary, one storage port and one
Backend serving route are sufficient for the current capability.

## Consequences

Positive:

- Product visibility is enforced at the Backend boundary on every image request.
- Existing v1 Mobile clients remain valid while image-aware Mobile adopts the v2 contract.
- Revisioned opaque keys provide deterministic replacement cache busting without storing URLs.
- PostgreSQL and object storage are coordinated with upload-first/CAS semantics, preserving
  the last confirmed image on failure and avoiding a Product row pointing at an unuploaded
  object.
- Production credentials and provider details stay outside Mobile, Admin and public JSON.

Negative:

- The API serves as a small media proxy and pays the read bandwidth/CPU cost.
- A failed post-commit delete can leave an inaccessible orphan until operator cleanup.
- Existing Product images must be supplied and backfilled before the `NOT NULL` contract;
  the task cannot invent placeholders or silently discard rows.
- `sharp` adds native optional packages to the lockfile and requires supported CI/runtime
  binaries.

## Verification sources

The provider and dependency checks were performed on 2026-08-28 against:

- [Yandex Object Storage overview](https://yandex.cloud/en/docs/storage/), including its
  S3 compatibility and Russia-region service boundary;
- [Yandex AWS SDK for JavaScript guide](https://yandex.cloud/en/docs/storage/tools/aws-sdk-js),
  which specifies `https://storage.yandexcloud.net` and `ru-central1`;
- [Yandex access management](https://yandex.cloud/en/docs/storage/security/) and
  [bucket lifecycle documentation](https://yandex.cloud/en/docs/storage/concepts/lifecycles);
- [sharp installation and runtime support](https://sharp.pixelplumbing.com/install/),
  [input limits](https://sharp.pixelplumbing.com/api-constructor/),
  [orientation](https://sharp.pixelplumbing.com/api-operation/) and
  [metadata stripping](https://sharp.pixelplumbing.com/api-output/);
- [@fastify/busboy limits](https://github.com/fastify/busboy) and the patched releases for
  [boundary DoS](https://github.com/fastify/busboy/security/advisories/GHSA-xjh9-v7x6-24jw),
  [prototype header DoS](https://github.com/fastify/busboy/security/advisories/GHSA-x8mw-p69m-v3mx)
  and [CR/LF injection](https://github.com/fastify/busboy/security/advisories/GHSA-gxm5-99cw-xjw9).

## Approval gate

ADR-003 remains accepted and is not changed by this ADR. This ADR was explicitly accepted by
the project owner on 2026-08-28, so VPZH-030 runtime implementation may proceed.
