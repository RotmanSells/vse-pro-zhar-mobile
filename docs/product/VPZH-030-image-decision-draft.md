# VPZH-030 — финальное техническое решение по изображениям товара

Статус: `ADR-004` — Accepted; `VPZH-030` — `in_progress` до прохождения
обязательных verification gates.

Этот документ фиксирует границу решения для VPZH-030. Архитектурное решение принято владельцем;
документ не реализует upload, storage,
обработку изображений, API или UI. `ADR-003` остаётся отдельным принятым решением только
для development/test Admin authorization и не является imagery ADR.

## Принятые продуктовые решения

1. У Product ровно одна главная картинка.
2. Картинка обязательна для каждой Product row после завершения rollout.
3. Загружает только Admin.
4. Источник — только upload файла; remote URL import отсутствует.
5. Production использует отдельное object storage, не диск API.
6. Входные форматы: JPG/JPEG, PNG и WebP.
7. После обработки хранится и отдаётся только WebP.
8. Максимальный входной файл — 10 MiB (`10,485,760` bytes).
9. Максимальный результат — 1600×1600 px.
10. Resize сохраняет aspect ratio, не crop и не padding.
11. Изображение можно заменить.
12. Отдельного удаления нет: операция без replacement не может оставить Product без image.
13. Guest получает изображение только для видимого Product.
14. Разрешено стандартное URL-based caching.

## Финальные технические решения

### Production storage

Выбран **Yandex Object Storage**, S3-compatible endpoint
`https://storage.yandexcloud.net`, region `ru-central1`, Standard storage class, public
read/list disabled, versioning disabled. Deployment default production bucket —
`vse-pro-zhar-product-images-prod`, development default — `vse-pro-zhar-product-images-dev`;
actual bucket name приходит через `VPZH_PRODUCT_IMAGE_BUCKET`, а automated tests используют
только injected adapters.

Production adapter — `YandexS3ObjectStorage` на `@aws-sdk/client-s3`; точный stable version
проверяется при обновлении lockfile и фиксируется exact pin. Сервисный
account имеет bucket-scoped read/write/delete access. Access key хранится в secret storage,
не передаётся клиентам и ротируется минимум раз в 90 дней с overlap нового/старого ключа на
время rolling restart. Storage calls имеют timeout 5 секунд и максимум 3 попытки; retry
допустим только для GET и идемпотентных PUT/DELETE.

Конфигурация:

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

Ключ объекта строится только Backend:

```text
product-images/{productId}/{imageRevision}.webp
```

`productId` и `imageRevision` — UUID, сгенерированные/проверенные Backend. Filename,
extension и MIME из запроса никогда не участвуют в object key. Original upload не хранится.

### Serving и Product contract

Выбран Backend-controlled serving:

```text
GET /products/:productId/image/:imageRevision
```

Bucket остаётся private, public URL storage и signed URL не выдаются. Endpoint перед
чтением storage проверяет `Product exists`, `admin_enabled = true` и соответствие revision
текущему `image_revision`. Unknown, hidden и stale revision получают один безопасный `404`.

Старые v1 paths `GET /products` и `GET /products/:id` не меняются, чтобы не ломать текущих
Mobile clients. Image-aware Mobile использует новые paths:

```text
GET /v2/products
GET /v2/products/:id
```

Их точная shared representation — существующие Product fields плюс единственное image-поле:

```ts
interface ProductWithImageResponse extends ProductResponse {
  readonly imageUrl: string;
}
```

`imageUrl` — абсолютный URL Backend, сформированный из `VPZH_PUBLIC_API_BASE_URL`, Product
UUID и opaque `imageRevision`. URL не хранится в PostgreSQL и не содержит storage endpoint,
bucket или credentials. Он стабилен после reload при неизменившейся картинке и меняется при
успешной замене, что даёт cache busting без отдельного cache service.

Image response:

```text
200 Content-Type: image/webp; Cache-Control: private, no-cache
304 при совпавшем ETag после проверки visibility/revision
404 NOT_FOUND для hidden/unknown/stale
503 STORAGE_UNAVAILABLE при timeout/provider failure
```

### Lifecycle и migration

Новая Product создаётся атомарной multipart-операцией:

```text
POST /v2/admin/products
Content-Type: multipart/form-data
fields: categoryId, name, basePriceMinor, adminEnabled, image
```

Legacy `POST /admin/products` с JSON остаётся только на 006 EXPAND, затем при write freeze
отключается и возвращает `410 LEGACY_ENDPOINT_DISABLED`.

После contract phase `image` обязателен, `adminEnabled` остаётся прежним флагом visibility,
а отдельный draft/publication framework не вводится. Replacement:

```text
PUT /v2/admin/products/:productId/image
Content-Type: multipart/form-data
field: image
```

`DELETE /admin/products/:id/image` отсутствует. New object загружается первым, затем Product
row обновляется compare-and-set. При storage/processing/DB failure прежняя подтверждённая
картинка сохраняется. При проигрыше concurrent replacement возвращается `409 CONFLICT`,
новый orphan удаляется bounded retry. Старый object удаляется после commit; если cleanup не
удался, Product остаётся корректным, ошибка логируется безопасно, а orphan недоступен через
Backend и подлежит ручной уборке.

Используются две versioned migrations:

```text
006_add_product_image.sql
  ADD COLUMN image_revision UUID NULL

007_enforce_product_image.sql
  ALTER TABLE products ALTER COLUMN image_revision SET NOT NULL
```

Rollout строго такой:

```text
006 EXPAND nullable
→ image-aware code, old reads remain compatible
→ freeze Product writes / only image-aware Admin boundary
→ process and upload an explicit source image for every existing Product
→ verify no NULL image_revision and every object is readable
→ drain old API/Admin writers
→ 007 CONTRACT NOT NULL
→ deploy/unfreeze final writes
```

Отсутствующий source image останавливает rollout. Existing Products не удаляются, не
получают placeholder и не скрываются молча; `admin_enabled` не меняется. Старые writers
могут существовать только до write freeze и до `007`, поэтому mixed-version deployment не
может создать новый Product без image в contract phase.

### Image processing и security

Используется `sharp@0.35.4`: Node `24.14.1` проекта поддерживается. Input pipeline:

- `@fastify/busboy@3.2.2` принимает ровно один `image` file part, четыре text fields,
  максимум пять parts, ограниченные headers/field sizes и `fileSize=10,485,760`;
- multipart boundary проверяется до parser и не превышает 70 bytes; общий body limit —
  `10,551,296` bytes (10 MiB file + 64 KiB fields/framing);
- Admin authentication/permission и rate limit 10 image mutations per principal per 60 s
  выполняются до decode; одновременно обрабатываются максимум 2 изображения на API process;
- filename/extension и multipart MIME являются недоверенными hints и не определяют приём;
  decoder должен подтвердить ровно JPEG, PNG или WebP;
- `metadata()` проверяется до full decode; максимум decoded input — **25,000,000 pixels**,
  максимум width и height — **10,000 px**;
- malformed/truncated input, unsupported channels, APNG `acTL`, animated WebP frame markers
  и любой multi-frame input отвергаются; первый frame не принимается;
- Sharp получает `limitInputPixels=25_000_000`, `limitInputChannels=4`, `pages=1`,
  `animated=false`, `sequentialRead=true`, `failOn='warning'` и processing timeout 5 s;
- EXIF orientation применяется до resize; затем `.resize({ width: 1600, height: 1600,
fit: 'inside', withoutEnlargement: true })` и WebP encode quality 82;
- EXIF/GPS/thumbnails, ICC, XMP, comments и любые прочие source metadata удаляются; output
  переводится в sRGB, alpha сохраняется, если он есть.

Ошибки используют safe stable codes: `INVALID_REQUEST` (400),
`AUTHENTICATION_REQUIRED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409),
`PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415), `INVALID_IMAGE` (422),
`STORAGE_UNAVAILABLE` (503), без SQL, provider details, stack trace или credentials.

## Почему не альтернативы

- Public bucket URL не позволяет надёжно сохранить hidden Product boundary и раскрывает
  provider.
- Signed URL добавляет expiring bearer token, expiry/client complexity и provider leakage без
  пользы для текущего масштаба.
- AWS S3 зрелый, но отдельные AWS account/region/ops не нужны при наличии подходящего
  `ru-central1` provider.
- Cloudflare R2 S3-compatible, но его documented endpoint использует `region: auto` и
  account URL, тогда как текущему проекту нужен российский region boundary.
- Local disk, CDN, queue и generic media service нарушают production requirement или
  `CORE-001`.

Полный architectural context, consequences, alternatives и approval gate зафиксированы в
[`ADR-004`](../adr/ADR-004-product-image-storage-and-serving-boundary.md).

## Проверенные источники

Проверено 2026-08-28: [Yandex Object Storage](https://yandex.cloud/en/docs/storage/),
[AWS SDK for JavaScript guide](https://yandex.cloud/en/docs/storage/tools/aws-sdk-js),
[sharp installation](https://sharp.pixelplumbing.com/install/),
[sharp constructor limits](https://sharp.pixelplumbing.com/api-constructor/),
[sharp orientation](https://sharp.pixelplumbing.com/api-operation/),
[sharp output metadata](https://sharp.pixelplumbing.com/api-output/) и
[@fastify/busboy security releases](https://github.com/fastify/busboy/security/advisories).
