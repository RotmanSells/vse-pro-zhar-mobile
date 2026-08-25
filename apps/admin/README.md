# Admin shell

`@vse-pro-zhar/admin` is the Next.js App Router shell for the administrative web
application.

- `app/layout.tsx` provides the root document and shell.
- `app/page.tsx` is the single initial route.
- `app/menu/category-create-form.tsx` is the Category presentation; its server action keeps
  the browser on the Admin origin.
- `src/main.ts` composes the Category Application operation with the server-side Backend
  adapter in `src/infrastructure/catalog/category-api-client.ts`.
- The adapter reads `VPZH_ADMIN_API_BASE_URL`, accepting only HTTP/HTTPS URLs without embedded
  credentials, and adds the development-only ADR-003 header server-side.
- The package contains no production Admin authentication, database access or generic Admin
  authorization.

Run `pnpm --dir apps/admin dev` during development. Use
`pnpm --dir apps/admin build` followed by `pnpm --dir apps/admin start` for the production
runtime.

`pnpm --dir apps/admin test:integration` builds the production application, starts it through
`next start`, requests the real root route and terminates the child process.

`next-env.d.ts`, `.next/` and the incremental TypeScript `*.tsbuildinfo` artifact are
generated locally and deliberately excluded from Git and formatting checks.
