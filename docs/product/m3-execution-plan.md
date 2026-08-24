# M3 — Menu, Search and Availability Execution Plan

## 1. Purpose

This document is the living execution plan only for **M3 — Menu, Search and
Availability**.

It is subordinate to `docs/product/product-definition.md`,
`docs/product/core-product-contracts.md`, `docs/product/roadmap.md`, `RULES.md`
and accepted ADRs. It is not a new product source of truth and does not replace
`roadmap.md`.

This document is not a Task Manifest. It describes planning-level boundaries and
the intended order of future coherent vertical slices. The exact scope of every
executed task is defined by a separate `docs/tasks/VPZH-XXX.yaml`, created
just-in-time immediately before implementation.

The plan may be corrected after M3 tasks are merged and the resulting `main` has
been inspected. Provisional planning IDs and boundaries are not frozen contracts.
No implementation is part of VPZH-024.

## 2. Canonical M3 Outcome

At the end of M3:

```text
Guest opens the Mobile app
  → sees real persisted categories and products
  → opens product details
  → searches approved local fields
  → sees current orderability information
  → can browse an explicitly permitted cached menu on a poor/offline connection

Admin manages approved menu data and Admin visibility.
Our Backend/PostgreSQL owns categories, products, prices, images and menu data.
iiko supplies operational stop-list availability only.
```

The customer-facing orderability rule is:

```text
product_is_orderable = admin_enabled AND iiko_available
```

The cached copy is a browse aid, never an authority for checkout. M3 does not
implement checkout; therefore it must not imply that a cached item can later be
ordered without an online backend recheck.

## 3. Non-Negotiable Product Boundaries

### Catalog model

- The catalog has exactly two levels: `Category → Product`.
- A Product belongs to exactly one Category.
- Subcategories, category hierarchies, tags, warehouse inventory, modifiers,
  combos, SEO and an arbitrary publication model are not introduced by M3.
- Product work uses only the approved product concepts: name,
  description/ingredients, price, weight, image, category, new/hit and
  availability.

### Ownership

| Capability                     | Owner                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Category and Product records   | Our Admin / Backend / PostgreSQL                                                     |
| Menu content and prices        | Our Admin / Backend / PostgreSQL                                                     |
| Product image metadata/assets  | Our approved image decision and Backend boundary; provider remains TBD until decided |
| `admin_enabled`                | Our Admin / Backend                                                                  |
| `iiko_available` and stop-list | iiko through a Backend adapter                                                       |
| Final checkout price           | Backend, outside M3                                                                  |

iiko is not the canonical source for the menu, Product records, Category
structure, prices or Admin visibility. The iiko simulator is a development/test
substitute only; it is not a production dependency and must not be changed by
M3.

### Explicit M3 exclusions

M3 ends before:

- cart or favorites, which belong to M4 where applicable;
- checkout or payment;
- order creation or iiko order submission;
- kitchen lifecycle statuses (`accepted`, `cooking`, `ready_for_pickup`,
  `completed`);
- warehouse inventory;
- production Phone/SMS OTP authentication, production Admin authentication or
  production-ready session/RBAC design;
- delete/archive/restore/cascade semantics that have not received an owner
  decision.

## 4. Current Starting Point

### Verified base

VPZH-024 was created from the refreshed `origin/main` at:

```text
5cd4539eb1d1b6d3087c875658fbd78c06a97a37
```

The following facts describe the starting point for this plan, not a greenfield
architecture.

### Existing production surfaces

| Surface              | Current fact at M3 start                                                                                                                                                                      | M3 implication                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`           | Node.js + TypeScript API with a real `GET /health`, VPZH-017 persisted customer profile (`GET/PATCH /me/profile`) and VPZH-021 test-only legal acceptance (`GET/POST /me/legal-acceptances`). | New menu capabilities should extend the existing API composition and safe error/runtime-validation patterns.                    |
| API layers           | HTTP Presentation calls Application use cases; Domain models are framework-independent; PostgreSQL repositories live in Infrastructure; `apps/api/src/main.ts` is the composition root.       | Menu slices must preserve `Presentation → Application → Domain` and adapter/port boundaries.                                    |
| PostgreSQL           | `pg` with parameterized SQL; versioned `001_create_customers.sql` and `002_create_customer_legal_acceptances.sql`; deterministic `applyMigrations`; isolated per-test schemas.                | Each persisted menu change needs its own migration and real integration evidence in its own future manifest.                    |
| `packages/contracts` | Shared runtime-validated Zod contracts for health, customer profile and test-only legal acceptance.                                                                                           | Each public menu boundary should add a shared/runtime-validated contract when the future task changes API shape.                |
| `apps/admin`         | Next.js App Router shell only: root layout and one page saying `Admin shell is ready.` No API client, authentication, business UI, DB or infrastructure adapter exists.                       | Admin work must be introduced inside the relevant menu slices; there is no existing Admin menu module to assume.                |
| `apps/mobile`        | Expo Router shell with one route, health state, guarded development/test identity, profile editing and test-only legal acceptance.                                                            | Menu screens, Application ports and HTTP clients are future additions; the current development identity is not production auth. |
| Mobile composition   | `MobileHealthRoot` wires API clients into Presentation; health/profile/legal clients own HTTP, timeout and Zod trust-boundary validation.                                                     | Future menu clients should continue to enter through composition and keep `fetch` out of Presentation.                          |
| E2E harness          | `.maestro/m1-health.yaml` and `.maestro/customer-profile.yaml`; API/Mobile/Admin start helpers and isolated PostgreSQL helpers already exist.                                                 | M3 should add or extend a focused real browse/search/offline flow; it must not repurpose the M1 health smoke.                   |
| CI                   | `verify.yml` runs the ordinary PR gate; the special Android jobs are currently routed to VPZH-014 and VPZH-018–021.                                                                           | M3 Mobile E2E routing will require a future task-level CI decision/change; VPZH-024 does not change CI.                         |

M2 is not required for Guest menu browsing. The existing M2 test identity may be
used by a later development/test E2E only where the task manifest explicitly keeps
it non-production and fail-closed.

### Existing iiko simulator (read-only)

The standalone simulator at `/Users/rotman/Desktop/vse-pro-zhar-iiko-simulator`
is available as a deterministic contract-faithful substitute. Its current
documentation exposes:

- local operation on `127.0.0.1:4010` by default;
- protected iiko-compatible HTTP routes with simulator credentials only;
- `POST /api/1/stop_lists` and mutable stop-list controls;
- synthetic Product identifiers and explicit future mapping documentation;
- fault modes for timeout, delay, connection drop, malformed JSON and selected
  HTTP statuses;
- no claim that public-schema conformance is real-iiko conformance; real captures
  remain pending.

M3 may consume this simulator in future tests, but may not modify its dataset,
contracts, mappings, implementation or credentials. iiko nomenclature/menu
endpoints remain completeness/reference capabilities, not a canonical catalog
source for this project.

### Pre-M3 gate — exact iiko API decision

The canonical roadmap made the exact iiko API and integration decision a
**pre-M3 gate**. VPZH-025 recorded that decision in ADR-002, and the owner
explicitly approved it on 2026-08-24. This gate is now closed; it did not
implement an iiko adapter.

The current status is:

```text
M3 feature work: UNBLOCKED BY ADR-002
Constraint: each feature still requires its own manifest and implementation-level
adapter decisions must remain within ADR-002
```

ADR-002 chooses the API, credentials ownership, provider context and integration
contract. VPZH-026 may begin under the accepted gate. The iiko adapter,
availability mapping and operational behavior are still implemented only in
VPZH-031.

## 5. Recommended Task Map

The recommended decomposition is **7 future feature tasks**. The IDs below are
provisional planning IDs; exact task manifests are created just-in-time from the
then-current `main`:

> **Provisional planning IDs; exact task manifest is created just-in-time from current main.**

The pre-M3 iiko API decision gate is accepted and recorded. All M3 feature tasks
remain subject to their own manifests, dependencies and implementation-level
decisions.

The slices are intentionally ordered by user capability and dependency. Admin,
API, persistence, Mobile and tests are included only in a slice when that
capability needs them; there is no standalone “all menu tables”, “all API” or
“all Admin UI” phase.

### VPZH-026 — Category catalog vertical slice

**Status:** planned

**Capability:** Establish the first persisted parent of the approved
`Category → Product` catalog.

**Observable scenario:** An approved test/local Admin action creates a Category →
the API validates the business input → PostgreSQL persists it → the Guest read
path returns the persisted Category → Mobile displays it → reload returns the same
Category.

**Depends on:** M1 shell, current API/PostgreSQL/composition patterns and the
accepted ADR-002 iiko API contract. M2 and Product data are not required by this
slice; the accepted contract constrains future M3 implementation.

**Unlocks:** The real parent relation needed by the first meaningful Product and
the first non-fixture Guest menu surface.

**Touched surfaces:** Admin, API Presentation/Application/Domain/Infrastructure,
PostgreSQL migration/repository, shared contracts, Mobile read Presentation and
Application/Infrastructure client, unit/integration tests, focused E2E/CI as
required by the final task manifest. No iiko.

**Likely:** API change, database change, contract change and a real browse/read
E2E or equivalent focused mobile evidence.

**In scope:** Minimum approved Category identity/name needed for the scenario,
create/read through real layers, one-to-many relation direction for future
Products, safe validation/errors and reload persistence.

**Out of scope:** Subcategories, hierarchy, tags, category publication state,
ordering rules not already approved, delete/archive/restore/cascade behavior,
Products, prices, images, iiko and production Admin authentication.

**TBD / owner decisions:** Exact Category fields beyond the minimum approved
concept; how a local/test Admin action is authorized before production Admin auth
is decided. The task may not silently invent an auth mechanism or delete policy.

**Primary risk:** Creating a richer Category model or CRUD contract than the
approved two-level catalog requires.

**Expected size:** medium.

### VPZH-027 — Product catalog, base price and Admin visibility

**Status:** planned

**Capability:** Add the first meaningful persisted menu item, including its
authoritative base price and the Admin-controlled `admin_enabled` state.

**Observable scenario:** Admin creates a Product in an existing Category with the
approved minimum product data and explicit visibility state → API validates and
persists it → Guest reads the real Product under its Category with the Backend
price → Mobile displays the persisted menu item after reload.

**Depends on:** VPZH-026.

**Unlocks:** A real menu dataset for product details, local search and operational
availability mapping.

**Touched surfaces:** Admin menu entry/list surface, API, Domain/Application,
PostgreSQL migration/repository, shared contracts, Mobile category/product browse,
unit/integration tests and focused E2E/CI. No iiko adapter yet.

**Likely:** API change, database change, contract change and E2E.

**In scope:** Product identity, one Category relation, name, authoritative base
price in RUB, Admin-owned `admin_enabled`, real persisted read/write flow and
customer catalog presentation that does not claim iiko availability.

**Out of scope:** Description/ingredients, weight, image storage/upload, search,
iiko availability, cart, final checkout price, promotions, modifiers, combos,
delete/archive semantics and any iiko catalog ownership.

**TBD / owner decisions:** Exact Product identifiers and minimum create/edit
contract; whether a new Product requires an explicit `admin_enabled` choice or an
approved default. No implicit publication model may be introduced. The task must
also distinguish catalog existence from orderability before `iiko_available`
exists.

**Primary risk:** Treating a locally persisted Product or `admin_enabled` as
orderable before the iiko availability boundary exists.

**Expected size:** large but coherent.

### VPZH-028 — Product details and approved metadata

**Status:** planned

**Capability:** Make a persisted Product useful as a product card/details view
without adding unsupported product concepts.

**Observable scenario:** Admin edits the approved Product details → API validates
and persists the change → Guest opens the Product card → Mobile shows the current
name, description/ingredients, weight, Category, price, new/hit state and the
Admin-owned catalog visibility input (`admin_enabled`) returned by our Backend →
reload retains the Backend result. VPZH-028 does not expose, calculate or assert
`iiko_available`, operational availability or `product_is_orderable`; those begin
only in VPZH-031.

**Depends on:** VPZH-027.

**Unlocks:** The approved local-search fields and a meaningful product-card
experience. It does not unlock checkout.

**Touched surfaces:** Admin Product form/details, API, Domain/Application,
PostgreSQL migration/repository, shared contracts, Mobile product details route,
unit/integration tests and focused E2E/CI.

**Likely:** API change, database change, contract change and E2E.

**In scope:** Description/ingredients, weight, new/hit, Product details read/write,
approved Category and price display, the Admin-owned `admin_enabled` input as
catalog data, safe nullability/validation and a real customer details flow. No
operational availability is produced by this slice.

**Out of scope:** Image storage/upload/provider, tags, modifiers, combos, SEO,
reviews, ratings, cart, favorites, checkout, price history, `iiko_available`,
`product_is_orderable`, operational availability and kitchen status.

**TBD / owner decisions:** Exact formatting/validation semantics where Product
Definition is silent; no new fields may be created to support UI convenience.

**Primary risk:** Turning the card into a second product model or implementing
presentation-only business rules in Mobile.

**Expected size:** medium.

### VPZH-029 — Product imagery

**Status:** planned — decision-gated

**Capability:** Deliver the approved Product `image` capability through a chosen,
reviewed storage/upload boundary.

**Observable scenario:** Admin adds or updates an approved Product image through
the owner-approved mechanism → Backend persists the approved image reference or
asset metadata → Guest/Mobile loads the image on the product card and browse view
→ a later read returns the same valid image representation.

**Depends on:** VPZH-028 and an owner-approved image storage/upload decision.

**Unlocks:** Complete approved Product presentation and the image portion of
cacheable menu browsing.

**Touched surfaces:** Admin, API, Application/Domain contract as needed,
Infrastructure storage/upload adapter as approved, PostgreSQL migration if
required, shared contracts, Mobile image presentation/cache integration, security
and file-validation tests, E2E/CI. No iiko.

**Likely:** API change, possibly database change, security-sensitive file boundary,
contract change and E2E.

**In scope:** Only the approved image field and the chosen safe asset/reference
flow; runtime validation, size/type/security limits and customer rendering.

**Out of scope:** Choosing a provider in this plan, S3, Cloudinary, CDN, local
production disk, arbitrary image transformation, image search, galleries and
image delete/archive semantics unless separately approved.

**TBD / owner decisions:** Storage/upload owner and provider, asset URL/reference
contract, retention/replacement rules, transformation/size policy and cache
invalidation. This task must not start with an invented provider.

**Primary risk:** Accidental irreversible commitment to an unapproved storage or
public-file security model.

**Expected size:** medium/large after the decision.

### VPZH-030 — Local catalog search

**Status:** planned

**Capability:** Search the sufficiently populated persisted local catalog using
only the approved fields.

**Observable scenario:** Guest opens the persisted catalog → enters a query →
Mobile locally returns matching Products by `name`, `description/ingredients` or
Category → the same search works over the currently loaded catalog without a
search-history feature.

**Depends on:** VPZH-027 and VPZH-028. Images and iiko availability are not
semantic prerequisites for matching.

**Unlocks:** The search portion of the M3 outcome and local search over the
offline cache in VPZH-032.

**Touched surfaces:** Mobile Application/search state and Presentation, catalog
read/cache boundary as needed, unit/component tests, a real catalog integration
fixture and focused E2E. API/DB are touched only if the selected persisted read
contract cannot supply the approved fields; no horizontal search backend is
assumed.

**Likely:** Mobile change, possibly shared contract/API additive change, and E2E;
no new database table is expected.

**In scope:** Local matching over exactly name, description/ingredients and
Category; loading, empty and safe failure states; deterministic behavior over the
persisted catalog.

**Out of scope:** Search history, tags, ranking/recommendation, analytics,
full-text infrastructure, remote search, arbitrary token fields and changes to
the approved catalog model.

**TBD / owner decisions:** Exact case/diacritic/tokenization behavior if product
requires a user-visible choice; do not invent relevance ranking or history.

**Primary risk:** Adding an unnecessary search service before the catalog is
realistically persisted and available locally.

**Expected size:** medium.

### VPZH-031 — iiko operational availability

**Status:** planned — later adapter decisions required

**Capability:** Connect real persisted Products to operational iiko stop-list
availability without giving iiko ownership of the menu.

**Observable scenario:** The standalone simulator/iiko endpoint reports a
stop-list state for a mapped Product → Backend adapter authenticates/configures
the external boundary, validates the response and applies a bounded timeout →
Application availability boundary maps it to `iiko_available` → API and Mobile
show orderability from `admin_enabled AND iiko_available` → timeout, malformed
response or safe external failure never becomes “available”.

**Depends on:** VPZH-027 for real Product identity and `admin_enabled`, plus the
accepted ADR-002 exact iiko API/integration contract. Product details are useful
but not a prerequisite for the mapping. The task manifest must still capture the
remaining adapter-level decisions before implementation.

**Unlocks:** Current operational availability for M3 and the availability input
that later checkout validation in M4/M5/M6 must use. It does not unlock iiko order
submission.

**Touched surfaces:** API Presentation/Application/Domain port, Infrastructure
iiko adapter, availability mapping/configuration, PostgreSQL only if the approved
sync strategy requires durable state, shared contracts, Mobile availability
presentation, simulator-backed contract/integration tests, security tests and
focused E2E/CI. The simulator repository itself remains untouched.

**Likely:** API/contract change, possibly database change, external adapter,
security/contract/integration tests and E2E.

**In scope:** Stop-list/operational availability only; Product-ID mapping;
runtime validation; timeout; bounded safe failure; simulator dev/test use; clear
separation between `admin_enabled` and `iiko_available`; observable formula
`admin_enabled AND iiko_available`.

**Out of scope:** iiko nomenclature/menu as canonical catalog, iiko price or
image ownership, organizations/terminal foundation as standalone tasks, order
submission, payment, kitchen status, real credentials, warehouse inventory and
unbounded retry/polling.

**Task-level decisions after ADR-002:** adapter configuration details,
real-to-simulator Product mapping source, refresh/synchronization cadence and
durable snapshot policy; stale/error presentation; the future exact availability
contract. These decisions must be recorded by the task owner before the manifest
freezes implementation scope and must remain within ADR-002. No real credentials
enter the repository.

**Primary risk:** Making a simulator response or stale snapshot authoritative, or
letting iiko silently become the catalog owner.

**Expected size:** large.

### VPZH-032 — Cached/offline menu browsing

**Status:** planned — final M3 slice

**Capability:** Keep an approved cached menu useful during offline/poor-network
conditions while making its authority boundary explicit.

**Observable scenario:** Mobile first loads the real persisted categories,
Products, approved details, price and image metadata/assets plus availability
context → connectivity is lost or degraded → Guest can browse the allowed cached
menu and search locally → cached availability is visibly stale/non-authoritative
and no checkout/payment/order action is exposed or authorized from it → when
online, a fresh Backend result can replace the cached view.

**Depends on:** VPZH-026 through VPZH-031, especially the real catalog, search,
approved image decision and iiko availability boundary.

**Unlocks:** The final M3 offline/browse exit criterion and the handoff to M4
without claiming that offline data can pass checkout.

**Touched surfaces:** Mobile Application/Infrastructure cache boundary and
Presentation, shared catalog contracts, API cache headers/read behavior only if
needed, unit/component/integration tests, network-failure tests, Maestro offline
flow and CI harness. No new iiko behavior.

**Likely:** Mobile change, possibly additive cache metadata contract, integration
tests and E2E; no new catalog ownership or order API.

**In scope:** Categories/menu/Product details/price/image metadata or assets that
are approved for caching; local search over cached menu; stale/offline state;
explicit prohibition on checkout/payment/order creation; refresh/replacement by
fresh backend data.

**Out of scope:** Offline cart, offline checkout, offline payment, order creation,
cached availability as authority, background sync promises not approved by the
task, conflict resolution for Admin edits and a new state-management framework.

**TBD / owner decisions:** Cache technology and eviction/version policy, exact
staleness labeling, image asset limits and refresh triggers. These are task-level
decisions constrained by the Offline Contract; none may weaken the authority rule.

**Primary risk:** Showing stale availability or price as current, or accidentally
allowing the future checkout boundary to trust local state.

**Expected size:** large.

## 6. Dependency Graph

```text
M1 current shell ───────────────────────┐
                                        ├──► VPZH-026 Category catalog
[PRE-M3: exact iiko API decision] ──────┘
                                             │
                                             ▼
VPZH-027 Product + base price + admin_enabled ───────────────► VPZH-031 iiko availability ──┐
            │                                                                                │
            ▼                                                                                │
VPZH-028 Product details ──────────────────────────────────► VPZH-030 Local search ──────────┤
            │                                                                                │
            ▼                                                                                │
VPZH-029 Product imagery ────────────────────────────────────────────────────────────────────┘
                                                                                             ▼
                                                                  VPZH-032 Cached/offline browse (M3 exit)
```

The graph has three deliberate decision gates:

1. The accepted ADR-002 contract constrains VPZH-026 onward; it is closed and
   does not move iiko implementation earlier.
2. Image storage/upload must be approved before VPZH-029 is implemented.
3. After the accepted ADR-002 contract, VPZH-031 still needs its adapter-level
   configuration, Product-ID mapping, refresh and failure behavior recorded in
   its own manifest.

VPZH-030 can proceed in parallel with imagery and iiko once its persisted search
fields exist. VPZH-032 is intentionally last because it consumes the final online
catalog semantics and must preserve both search and availability authority rules.

## 7. Critical Path

The recommended critical path is:

```text
[accepted ADR-002 contract]
  → VPZH-026
  → VPZH-027
  → VPZH-028
  → [image storage/upload decision]
  → VPZH-029
  → VPZH-030 and VPZH-031 (parallel where staffing permits)
  → VPZH-032
```

The following capability placement is deliberate:

| Capability               | First appears in | Reason                                                                                                              |
| ------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Category                 | VPZH-026         | Establishes the persisted parent and real Guest read path first.                                                    |
| Product                  | VPZH-027         | The first meaningful menu item is created against a real Category.                                                  |
| Authoritative base price | VPZH-027         | A Product without its approved base price is not a meaningful menu item; price is not a standalone horizontal task. |
| `admin_enabled`          | VPZH-027         | Admin visibility belongs with the first persisted Product, while remaining distinct from iiko availability.         |
| Product card/details     | VPZH-028         | Details are a coherent customer capability after the minimal menu item exists.                                      |
| Images                   | VPZH-029         | Delayed until an approved storage/upload decision; no provider is invented.                                         |
| Local search             | VPZH-030         | Starts only after a persisted Product dataset has name, Category and description/ingredients.                       |
| iiko availability        | VPZH-031         | First justified after real Product identities exist; iiko supplies only operational stop-list state.                |
| Cached/offline browse    | VPZH-032         | Final slice, after online catalog, search, imagery and availability boundaries are real.                            |

### Why VPZH-026 is first

Category alone is sufficiently observable without inventing a second level or
pretending a Product exists: Admin creates a Category, the backend persists it,
Guest read returns it, Mobile shows it and reload proves persistence. It establishes
the exact approved parent model and exercises the current repository/application/
presentation pattern at a bounded size. Starting with a Product would couple the
first task to Product fields, price, visibility and an unapproved default; starting
with iiko would be premature because there would be no canonical Product to map.

## 8. M3 Exit Criteria Mapping

| Roadmap exit criterion                                                  | Tasks that provide the evidence                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Exactly `Category → Product`, no deeper hierarchy                       | VPZH-026, VPZH-027, with contract/integration assertions carried forward by VPZH-028                        |
| Search is local over category, name and ingredients                     | VPZH-028 supplies approved fields; VPZH-030 implements and tests local matching                             |
| Admin and Mobile use real persisted menu content, not fixtures          | VPZH-026 through VPZH-028, with Admin mutation/read and Mobile reload evidence                              |
| Admin manages approved menu data and visibility                         | VPZH-026, VPZH-027, VPZH-028 and VPZH-029 through their real Admin/API/DB slices; no horizontal Admin task  |
| Prices are ours and not sourced from iiko                               | VPZH-027 introduces the Backend-owned base price; VPZH-031 explicitly forbids iiko catalog/price ownership  |
| Images are handled through an approved safe boundary                    | VPZH-029, only after the storage/upload owner decision                                                      |
| iiko provides operational availability                                  | VPZH-031 simulator-backed adapter, mapping, timeout/failure and API/Mobile evidence                         |
| `admin_enabled AND iiko_available` governs orderability information     | `admin_enabled` in VPZH-027; live combination and failure behavior in VPZH-031                              |
| Cached menu can be browsed offline/with poor network                    | VPZH-032 real online-to-offline Maestro and cache/network integration evidence                              |
| Cached availability never authorizes checkout                           | VPZH-032 explicit offline boundary; checkout remains outside M3 and future M4/M5 must recheck Backend state |
| No cart, checkout, payment, order submission or kitchen lifecycle in M3 | Scope exclusions in every manifest; final diff review at VPZH-032                                           |

The M3 milestone is not complete if the image decision or iiko decision is merely
assumed, if Admin/Mobile use fixtures instead of persisted data, or if offline
state is presented as checkout authority.

## 9. Decisions Deferred

The following decisions remain outside this plan and must not be silently selected
by a future implementation:

### Required before specific M3 slices

- Image storage/upload provider, asset/reference contract, file limits, replacement
  and cache invalidation behavior — before VPZH-029.
- Accepted ADR-002 is the source of truth for the exact iiko API/integration
  contract. VPZH-031 must define only its implementation-level adapter
  configuration, organization/terminal context, Product-ID mapping,
  operational-availability refresh strategy, durable snapshot policy and
  stale/error presentation. This does not authorize iiko implementation outside
  VPZH-031.
- The exact `admin_enabled` creation/default semantics, if the owner has not
  explicitly approved them — before VPZH-027.
- Any required Admin test/local authorization boundary — before the first Admin
  mutation slice; it must not be presented as production-ready Admin security.

### Task-level decisions constrained by approved contracts

- Menu API shapes, DB schema and migration details.
- Search case/diacritic/tokenization behavior, if it becomes user-visible; fields
  remain exactly name, description/ingredients and Category.
- Cache technology, eviction/versioning, stale labeling and refresh triggers.
- Availability snapshot storage, bounded timeout values and safe failure mapping;
  these cannot make stale state authoritative.
- Image/cache size and performance behavior after the provider decision.

### Explicitly not invented

- Admin email/password, username/password, JWT, OAuth, RBAC or production sessions.
- S3, Cloudinary, CDN, local production disk or another image provider.
- Category/Product delete, archive, restore or cascade semantics.
- iiko menu/catalog/price ownership, warehouse inventory, organizations foundation
  or order submission.
- Search history, tags, modifiers, combos, ranking or recommendation semantics.

The unresolved Admin authentication mechanism does not automatically block Guest
browse/search planning. It does mean that each Admin mutation task must state its
test/local boundary and must not make a production security claim until the owner
decision exists.

## 10. Plan Maintenance Rules

After every merged M3 task:

1. Check the new `main` and record the actual implemented capability.
2. Compare the implementation, contracts, tests and operational evidence with this
   plan.
3. Adjust only future planning-level boundaries that no longer fit the actual
   `main`; do not invent a new capability to hide an incomplete slice.
4. Never rewrite the history of completed tasks.
5. Create the next task manifest only after the plan has been reconciled with the
   current `main`.
6. Treat the executing task manifest as the strict scope contract for that task.
7. Keep provisional future IDs provisional until their own manifest is created.
8. Recheck API, database, security, ADR, documentation, integration and E2E impact
   before each task begins.

## 11. Progress

| Task     | Capability                                      | Status                                            | Depends on                                                          |
| -------- | ----------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| VPZH-024 | Define and maintain this M3 execution plan      | completed after the VPZH-024 docs task            | Current `origin/main` at `5cd4539eb1d1b6d3087c875658fbd78c06a97a37` |
| VPZH-025 | Exact iiko API owner decision                   | completed; ADR-002 Accepted and docs synchronized | Exact official API and simulator evidence                           |
| VPZH-026 | Category catalog vertical slice                 | planned                                           | M1/current API and PostgreSQL patterns + accepted ADR-002           |
| VPZH-027 | Product catalog, base price and `admin_enabled` | planned                                           | VPZH-026                                                            |
| VPZH-028 | Product details and approved metadata           | planned                                           | VPZH-027                                                            |
| VPZH-029 | Product imagery                                 | planned; image decision required                  | VPZH-028 + owner-approved image storage/upload decision             |
| VPZH-030 | Local catalog search                            | planned                                           | VPZH-027 + VPZH-028                                                 |
| VPZH-031 | iiko operational availability                   | planned; adapter decisions required               | VPZH-027 + accepted ADR-002 + adapter-level decisions               |
| VPZH-032 | Cached/offline menu browsing and M3 exit        | planned                                           | VPZH-026 through VPZH-031                                           |

The next implementation chat may create only the manifest for the next M3 feature
task under accepted ADR-002 and after review/merge of this task. The IDs for
VPZH-026 through VPZH-032 remain provisional until their own manifests are created.
