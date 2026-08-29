# Admin shell

`@vse-pro-zhar/admin` is the Next.js App Router shell for the administrative web
application. Its visual language follows the approved prototype, but the runtime
catalog is not copied from the prototype: it is read from the real Backend boundary.

- `app/layout.tsx` provides the root document and the responsive prototype-aligned shell.
- `app/admin-navigation.tsx` provides the shared navigation for the documented Admin sections.
- `app/page.tsx` is the Dashboard route; its catalog snapshot uses live Backend reads and its
  unavailable analytics use explicit placeholders.
- `app/[section]/page.tsx` exposes the documented deferred sections as non-mutating connection
  placeholders until their Backend/provider contracts exist. Orders explicitly remain read-only:
  iiko owns kitchen execution, stop-list availability and kitchen status operations.
- `app/menu/category-create-form.tsx` and `app/menu/product-create-form.tsx` are the catalog
  presentations; their server actions keep the browser on the Admin origin.
- `app/menu/page.tsx` is the only currently data-bearing Admin screen. Its categories, Products,
  names, prices, approved details, images and visibility states come only from the existing
  Admin/Backend operations; PostgreSQL remains the catalog authority.
- `app/menu/product-details-form.tsx` presents separate Product-details and catalog-visibility
  boundaries: it edits the approved description, weight, `Новинка` and `Хит` fields, while the
  visibility action changes only `admin_enabled`; name, Category and price remain read-only.
- `src/main.ts` composes the catalog Application operations with server-side Backend
  adapters in `src/infrastructure/catalog/category-api-client.ts` and
  `src/infrastructure/catalog/product-api-client.ts`.
- The adapter reads `VPZH_ADMIN_API_BASE_URL`, accepting only HTTP/HTTPS URLs without embedded
  credentials, and adds the development-only ADR-003 header server-side.
- The Product form chooses an existing Category, accepts a RUB price in user-facing text,
  converts it to integer kopecks and requires an explicit visible/hidden choice. The API
  adapter carries the ADR-003 development-only Admin header server-side.
- Product creation requires one local image file and submits it through the v2 multipart boundary;
  replacement uses the same-origin Server Action and the named v2 image endpoint. The Admin
  never receives object-storage credentials or provider URLs.
- Product details are loaded from the authenticated Admin catalog list, which includes hidden
  Products so they can be restored. Details and catalog visibility are saved through separate
  same-origin Server Actions and named development/test Admin boundaries.
- The package contains no production Admin authentication, database access or generic Admin
  authorization. `adminEnabled` is catalog visibility only and does not promise operational
  availability or orderability; iiko owns stop-list and kitchen operations.
- The Admin runtime contains no prototype records, sample prices, demo products, fake orders,
  mock data loader or local-storage catalog. A not-yet-connected screen displays an explicit
  placeholder/empty/error state and names its future data owner instead of fabricating rows.
- Orders remain a read-only/diagnostic placeholder until a Backend/iiko contract exists; Admin
  never manually changes kitchen statuses or duplicates iiko operations.

Run `pnpm --dir apps/admin dev` during development. Use
`pnpm --dir apps/admin build` followed by `pnpm --dir apps/admin start` for the production
runtime.

`pnpm --dir apps/admin test:integration` builds the production application, starts it through
`next start`, requests the real root route and terminates the child process.

`next-env.d.ts`, `.next/` and the incremental TypeScript `*.tsbuildinfo` artifact are
generated locally and deliberately excluded from Git and formatting checks.
