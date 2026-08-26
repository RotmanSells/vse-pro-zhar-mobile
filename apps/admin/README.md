# Admin shell

`@vse-pro-zhar/admin` is the Next.js App Router shell for the administrative web
application.

- `app/layout.tsx` provides the root document and shell.
- `app/page.tsx` is the single initial route.
- `app/menu/category-create-form.tsx` and `app/menu/product-create-form.tsx` are the catalog
  presentations; their server actions keep the browser on the Admin origin.
- `src/main.ts` composes the catalog Application operations with server-side Backend
  adapters in `src/infrastructure/catalog/category-api-client.ts` and
  `src/infrastructure/catalog/product-api-client.ts`.
- The adapter reads `VPZH_ADMIN_API_BASE_URL`, accepting only HTTP/HTTPS URLs without embedded
  credentials, and adds the development-only ADR-003 header server-side.
- The Product form chooses an existing Category, accepts a RUB price in user-facing text,
  converts it to integer kopecks and requires an explicit visible/hidden choice. The API
  adapter carries the ADR-003 development-only Admin header server-side.
- The package contains no production Admin authentication, database access or generic Admin
  authorization. `adminEnabled` is catalog visibility only and does not promise orderability.

Run `pnpm --dir apps/admin dev` during development. Use
`pnpm --dir apps/admin build` followed by `pnpm --dir apps/admin start` for the production
runtime.

`pnpm --dir apps/admin test:integration` builds the production application, starts it through
`next start`, requests the real root route and terminates the child process.

`next-env.d.ts`, `.next/` and the incremental TypeScript `*.tsbuildinfo` artifact are
generated locally and deliberately excluded from Git and formatting checks.
