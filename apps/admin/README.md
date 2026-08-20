# Admin shell

`@vse-pro-zhar/admin` is the Next.js App Router shell for the administrative web
application.

- `app/layout.tsx` provides the root document and shell.
- `app/page.tsx` is the single initial route.
- The package contains no API client, authentication, business UI, database access or
  infrastructure adapters.

Run `pnpm --dir apps/admin dev` during development. Use
`pnpm --dir apps/admin build` followed by `pnpm --dir apps/admin start` for the production
runtime.

`pnpm --dir apps/admin test:integration` builds the production application, starts it through
`next start`, requests the real root route and terminates the child process.

`next-env.d.ts`, `.next/` and the incremental TypeScript `*.tsbuildinfo` artifact are
generated locally and deliberately excluded from Git and formatting checks.
