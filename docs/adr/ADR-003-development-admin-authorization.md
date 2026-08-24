# ADR-003: Development/test Admin authorization boundary

- Status: Accepted
- Date: 2026-08-24
- Owner approval: Approved by owner on 2026-08-24
- Scope: decision for local/test authorization of future Admin mutation slices

## Context

The first M3 Category mutation slice is blocked because the current Admin surface is
only a Next.js shell. It has no authentication, authorization, API client, business
mutation boundary or persistence adapter. A future Category slice needs a safe way to
exercise Admin mutations in development and test before production Admin
authentication is selected.

Production Admin authentication is deliberately still `TBD` in the canonical Product
Definition. This decision therefore solves only the temporary local/test boundary. It
does not select a production login mechanism.

## Current State

- `apps/admin` contains a shell only: no API client, authentication, business UI,
  database access or infrastructure adapter.
- The API has a customer-only development identity boundary using
  `X-VPZH-Development-Identity` and a trimmed customer phone value.
- `VPZH_ENABLE_DEVELOPMENT_IDENTITY` is an explicit non-production opt-in; the
  existing resolver fails closed when the runtime is production.
- The current customer identity is resolved into `/me/*` customer application use
  cases and can create or load a customer profile by phone.
- No Admin principal, Admin resolver, Admin permission boundary or production Admin
  authentication exists.
- The public API error contract currently has a stable `AUTHENTICATION_REQUIRED`
  error but no Admin-specific contract. This ADR does not change that contract;
  a future Admin implementation must add any required error code additively.

## Security Requirements

This decision addresses the `SEC-004` requirements before any Admin mutation is
implemented:

- authentication/identity: one synthetic non-production Admin principal;
- role: one explicit `admin` role;
- permissions: endpoint/action-specific Admin authorization;
- sessions/tokens: explicitly none;
- rate limiting: the non-production boundary does not bypass existing API/edge
  limits, and a dedicated production policy remains a future decision;
- validation: runtime validation at the HTTP trust boundary.

`SEC-006` makes the negative authorization cases mandatory regression/security
evidence for the future implementation. No production bypass, secret or customer
identity reuse is permitted.

## Decision

Create a separate development/test Admin identity boundary when the first future
Admin mutation slice is implemented. The owner accepted the following conceptual
flow:

```text
HTTP request
  → Admin development identity boundary
  → synthetic DevelopmentAdminPrincipal
  → Admin application authorization for the named operation
  → Admin mutation use case
```

The Admin boundary must have its own resolver/port and principal type. It must not
call, wrap or broaden the customer `DevelopmentIdentityResolver`, and it must not
turn an Admin principal into a customer identity. The boundary is scoped to Admin-
designated operations; it is not a general authenticated-user bypass.

## Identity Contract

The local/test identity represents one deterministic synthetic actor:

```text
kind = development_admin
subject = development-admin
role = admin
```

This principal is a test/development execution identity, not a production user and
not a credential stored in PostgreSQL. It has no phone, customer UUID, customer
profile, account record, password, secret, session or token. One principal and one
role are sufficient for the current local/test Admin scenarios; no `super_admin`
variant or generic RBAC model is introduced by this decision.

## Transport Contract

The request declares the synthetic identity through this dedicated HTTP header:

```text
X-VPZH-Development-Admin-Identity: admin
```

The header name is case-insensitive according to HTTP; the canonical spelling above
is used in documentation and tests. The value is accepted only when it is a single
string whose trimmed value is exactly the lowercase literal `admin`. Missing values,
empty values, non-string/duplicate header values and any other value are invalid.

The boundary must not use `Authorization: Bearer`, cookies, query parameters, request
bodies or the customer `X-VPZH-Development-Identity` header. The literal is a
synthetic identity selector, not a production credential and must never be presented
as production authentication.

## Runtime Gate

The boundary is enabled only when both conditions hold:

```text
runtime ∈ {development, test}
AND VPZH_ENABLE_DEVELOPMENT_ADMIN_IDENTITY === "true"
```

The proposed flag is `VPZH_ENABLE_DEVELOPMENT_ADMIN_IDENTITY`. Its default is
disabled (`false`/unset). Any value other than the exact string `true` leaves the
boundary disabled.

Production is fail closed by construction:

```text
runtime === production
→ never yield DevelopmentAdminPrincipal
```

This production rule wins even if the header is supplied and the flag is set to
`true`. There is no configuration combination that enables this identity in
production, and a production request must not fall back to customer identity.

## Roles and Permissions

The only role produced by this boundary is `admin`. A future Admin endpoint must be
explicitly marked as an Admin operation and must perform an Application-layer
authorization check for that operation before invoking its mutation use case.

The synthetic Admin principal therefore:

- may authorize only explicitly Admin-designated local/test operations;
- does not authorize customer `/me/*` operations;
- does not authorize arbitrary authenticated API operations;
- does not imply `super_admin`, platform-owner or unrestricted access;
- cannot be used as a customer phone identity.

If a future endpoint receives a principal with no required role/permission, the
Application authorization check must deny it. This is endpoint-scoped authorization,
not a generic RBAC platform.

## Sessions and Tokens

No session, JWT, access token, refresh token, cookie, SecureStore value or database
credential is created for this identity. Each request is independently validated by
the non-production boundary. This is the smallest deterministic model for local,
integration and E2E tests and avoids creating a misleading production-auth lifecycle.

The absence of sessions/tokens is limited to this synthetic development/test
boundary. It must not constrain the later owner decision for production Admin
authentication.

## Rate Limiting

The current repository has no dedicated Admin rate limiter. A local/test synthetic
identity does not need a production-scale Admin limiter because the boundary is
runtime-gated away from production and is intended for bounded local, integration and
E2E processes. The future implementation must not disable or bypass any existing
global API, reverse-proxy or test-harness request limits.

This ADR does not claim that the synthetic header is safe to expose on a public
non-production service. A production Admin rate-limiting policy, including limits,
burst behavior, abuse response and observability, must be decided together with
production Admin authentication before any production Admin surface is exposed.

## Validation and Error Semantics

Header parsing is runtime validation at the HTTP trust boundary. Invalid input must
never reach the Admin Application or Domain layer. The resolver must reject missing,
malformed, duplicate and disabled inputs without logging the header value.

The future Admin HTTP boundary uses stable, safe errors:

| Condition                                       | HTTP status | Stable error              | Safe message              |
| ----------------------------------------------- | ----------: | ------------------------- | ------------------------- |
| Missing header                                  |         401 | `AUTHENTICATION_REQUIRED` | `Authentication required` |
| Malformed/duplicate header                      |         401 | `AUTHENTICATION_REQUIRED` | `Authentication required` |
| Boundary disabled                               |         401 | `AUTHENTICATION_REQUIRED` | `Authentication required` |
| Production runtime, regardless of header/config |         401 | `AUTHENTICATION_REQUIRED` | `Authentication required` |
| Principal lacks the endpoint permission         |         403 | `FORBIDDEN`               | `Forbidden`               |

The implementation must use the repository's shared runtime-validated API error
contract. If `FORBIDDEN` is needed, adding it is a separate additive implementation
change; this ADR intentionally does not change `packages/contracts` or any
endpoint. Responses must not reveal whether the flag was set, which runtime was
detected, which header value was supplied or which internal check failed. No stack
trace, secret, token, SQL or customer data may be returned.

## Required Security Tests

The future implementation must provide unit and HTTP integration evidence, plus the
Admin mutation E2E coverage required by its own manifest, for at least these cases:

1. A valid `X-VPZH-Development-Admin-Identity: admin` request yields the synthetic
   Admin principal and can pass an explicitly authorized Admin mutation in
   development.
2. The same valid request works in test runtime when the test opt-in is enabled.
3. Missing identity is rejected with the safe 401 contract.
4. Empty, malformed, wrong-value and duplicate identity input is rejected with the
   same safe 401 contract.
5. `X-VPZH-Development-Identity` and any customer phone value cannot authorize an
   Admin mutation.
6. An Admin principal is never accepted by a customer `/me/*` identity path and
   never creates or loads a customer through the Admin boundary.
7. Production runtime rejects the Admin header even when the configuration flag is
   supplied as `true`.
8. A disabled development/test boundary rejects the Admin header.
9. A principal without the required Admin operation permission receives the safe
   403 contract; authentication alone is not global mutation permission.
10. The resolver never creates a session, token, customer record or persisted Admin
    credential, and tests do not log the header value or secrets.

## Production Boundary

This decision does not select or implement production Admin authentication. It does
not choose username/password, email/password, JWT architecture, OAuth, NextAuth or
Auth.js, SSO, cookies, a session database, refresh tokens, an RBAC platform or Admin
account provisioning. Production Admin authentication, production roles and the
production rate-limiting/session/token model remain a separate owner decision.

The development/test header is never a production bypass, and a production runtime
must fail closed even under accidental configuration or request-header reuse.

## Alternatives Considered

1. **Reuse the customer development phone identity — rejected.** It would cross the
   customer/Admin trust boundary, allow a customer identity to authorize a mutation,
   and make Admin actions look like customer actions in Application and persistence
   code.

2. **No authentication for local Admin endpoints — rejected.** It would leave the
   Admin mutation boundary undefined, make accidental exposure easier and provide no
   reusable authorization contract for integration/E2E tests.

3. **Build production password or JWT Admin authentication now — rejected.** The
   production mechanism is an explicit Product Definition `TBD`, and choosing it here
   would expand a prerequisite decision into an unapproved production feature.

4. **Build a generic RBAC framework — rejected.** The current local/test need has one
   synthetic Admin actor and one role. A framework would add surface and policy before
   the production role/account model is approved.

5. **Use a dedicated development/test Admin identity boundary — recommended.** It is
   isolated from customer identity, deterministic for tests, explicitly opt-in,
   production fail-closed and small enough to implement with the first Admin slice.

## Consequences

Benefits:

- future M3 Admin mutation slices have a precise, testable local/test trust boundary;
- customer identity and Admin identity remain different types and flows;
- production cannot accidentally honor the development header;
- the implementation avoids credential persistence, token lifecycle and premature
  production-auth architecture;
- integration and E2E tests can use one deterministic principal.

Costs and limitations:

- the literal header is intentionally not suitable for a public or production
  service;
- every future Admin operation must opt into explicit Application authorization;
- a future production authentication decision remains necessary before production
  Admin exposure;
- the eventual implementation must add the required security tests and, if needed,
  the additive `FORBIDDEN` API error contract.

## Explicitly Deferred

- production Admin authentication mechanism and account provisioning;
- production sessions, tokens, cookies, refresh, SSO/OAuth and password policy;
- production Admin role hierarchy, super-admin semantics and generic RBAC;
- production Admin rate limits and abuse/observability policy;
- Admin mutation endpoints, Category implementation, Product implementation and all
  M3 runtime code.

## Owner Decision

The owner decision was recorded on 2026-08-24:

```text
APPROVE ADR-003
```

ADR-003 is Accepted. The local/test Admin authorization gate is closed; production
Admin authentication remains `TBD`, and no runtime implementation is included in
this ADR.
