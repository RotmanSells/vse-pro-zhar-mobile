# Все Про Жар — Development Roadmap

## 1. Purpose and Boundaries

This is the single canonical roadmap for building the approved first release of
«Все Про Жар». It sequences **vertical capabilities**, their dependencies and the
evidence required to call each milestone complete. It does not specify API shapes,
database schema, provider SDKs, deployment, estimates or dates.

The roadmap is subordinate to
[Product Definition](./product-definition.md),
[Core Product Contracts](./core-product-contracts.md), `RULES.md`, accepted ADRs,
architecture documentation and `AUTOMATION.md`. A prototype remains only a secondary
UI reference. In particular, a milestone must not reinterpret an approved contract
or turn a documented `TBD` into a decision.

The first release is one pickup-only restaurant. Delivery, reviews, multiple
restaurants/cities, marketplace, customer web ordering, courier and separate kitchen
applications are not roadmap capabilities for this release.

### Completion Standard

A milestone is not complete merely because a screen, endpoint, table or adapter
exists. Its stated capability must work through the relevant real layers; the
applicable automated unit and integration tests must exist; the applicable PR checks
must pass, and the complete `pnpm verify` gate must pass on `main` or during a manual
full verification before release. The listed scenario must be accepted through the
currently approved route. By owner decision, Mobile acceptance is currently manual on
a physical phone through Expo Go; automated Android/device E2E through Maestro is
disabled until separately re-enabled.
Documentation and contracts change only when the capability actually changes them.

Integration tests belong to the slice that introduces the backend boundary or
invariant: PostgreSQL, payment handling, iiko, refunds, loyalty and wheel rewards are
not deferred to a separate testing phase. The owner may later re-enable Maestro scenarios;
until then, mobile vertical capabilities are accepted manually through Expo Go.

### Task Sizing

One task is one coherent vertical slice, not a target line count. About 500–2000
meaningful lines is the normal planning band; a larger coherent slice is allowed, but
around 2500–3000 lines requires reconsideration under project governance and more
than 3000 requires the approved exception process. A future task manifest, not this
roadmap, defines its final scope and verification.

## 2. Dependency Chain

```text
M0 Engineering PR Safety
  ↓
M1 Running Application Shell
  ↓
M2 Customer Identity
  ↓
M3 Menu, Search and Availability
  ↓
M4 Cart, Pricing and Favorites
  ↓
M5 Pickup Checkout
  ↓
M6 SBP Payment and Order Acceptance
  ↓
M7 Kitchen Lifecycle and Order History
  ↓
M8 Cancellation, Refund and Reliability
  ↓
M9 Loyalty, Embers, XP and Ranks
  ↓
M10 Wheel and Quests ──┐
                         ├→ M11 Segments, Push and Messaging
M9 ────────────────────┘
                         ↓
M12 Admin Completion, Analytics and Health
                         ↓
M13 Production Readiness and First Release
```

M10 and the data model work for M11 may overlap only after M9 has established the
completed-order reward boundary. No overlap may bypass the listed contracts or make a
mock-only implementation appear complete.

### Owner decision: development/test identity sequencing

Real SMS OTP authentication is intentionally deferred to the final
production-readiness/release stage before deployment. This changes milestone sequencing,
not the production product requirement: the first production release still uses Phone +
SMS OTP, and password, email, Apple and Google login remain out of scope.

- Intermediate milestones use only a strictly bounded non-production development/test
  identity so product screens can be built and exercised without an SMS provider.
- SMS provider integration, OTP sending/verification and production authentication/session
  are deferred to M13; this does not defer customer/profile/legal-acceptance foundations
  that can be developed against the non-production test identity.
- M2 is not blocked by the absence of an SMS provider, but this development/test identity
  is never production authentication.
- Production release is blocked until real Phone + SMS OTP has passed security,
  integration and E2E verification.
- Before production deployment, the development/test identity path MUST be disabled,
  removed or technically unreachable from the production runtime, and the real OTP path
  MUST replace it.
- When a vertical slice first needs a backend customer context, it requires a separate
  task for a non-production backend test-identity boundary with production fail-closed
  guarantees. VPZH-016 does not create that backend boundary; VPZH-017 is the scoped task
  for the persisted customer/profile foundation.
- VPZH-018 connects the guarded VPZH-016 mobile identity to the existing VPZH-017
  `GET /me/profile` and PostgreSQL path. It remains a non-production test capability and
  does not advance SMS OTP, sessions, legal acceptance or profile completion.
- VPZH-020 edits nullable name and optional birthday through the existing
  `PATCH /me/profile`, uses only the backend-returned profile as saved state and does not
  make name globally required or introduce profile-completion/onboarding state.
- VPZH-021 adds persisted required Privacy Policy/User Agreement acceptance only through the
  guarded test identity, using explicitly non-production metadata/versions until owner-approved
  production legal text/version exists.

## 3. Milestones

## M0 — Engineering PR Safety

### Goal

Technically enforce the existing PR-policy backlog before active product development.

### Outcome

Every product task can be identified deterministically, constrained to its declared
scope, verified through one PR entrypoint and prevented from merging when mandatory
checks fail. Direct pushes to `main` are technically blocked where GitHub policy
supports it.

### Included capabilities

- `check:task-contract` with explicit `TASK_ID=VPZH-XXX` resolution;
- `check:task-scope` and `check:diff-size`;
- repository and PR-diff secret scanning plus dependency hygiene;
- incremental `verify:pr` planning and PR CI wiring;
- quick `pnpm verify:fast` after ordinary merges to `main`, with complete `pnpm verify`
  explicitly run at stage closure through `VPZH_MILESTONE=<stage> pnpm verify:milestone`;
- GitHub PR-only, required-check, stale-head revalidation and squash-merge policy
  for `main`, where technically available.

### Dependencies

Existing VPZH-001 foundation, task schema, `AUTOMATION.md` PR-policy backlog and
machine-readable rules mapping.

### Critical contracts

`TASK-001` through `TASK-006`, `SCOPE-001`, `SCOPE-004` through `SCOPE-006`,
`GIT-001`, `SEC-001`, `SEC-003`, `SEC-007`, `AUTO-009` and `AUTO-010`.

### Critical E2E

Contributor supplies `TASK_ID=VPZH-XXX` for a PR
→ CI resolves only `docs/tasks/VPZH-XXX.yaml`
→ an out-of-scope change, oversized meaningful diff, fake-secret fixture or broken
dependency policy makes the relevant gate fail
→ `verify:pr` and GitHub required checks block merge.

### Exit criteria

- The active task is never guessed from manifest status; `TASK_ID` is explicit and
  a branch name is at most a validating signal.
- Generated files, lockfiles and snapshots cannot conceal a large meaningful diff.
- Secrets scanning covers repository and PR diff; negative fixtures contain only fake
  values.
- `verify:pr` selects only impacted workspace packages and relevant integration boundaries
  from the committed diff, then always runs `task-contract → task-scope → diff-size →
secrets → dependencies`.
- ordinary pushes to `main` run `pnpm verify:fast`; stage closure uses the manual full
  `pnpm verify` gate, including workspace builds, with an explicit stage identifier.
- Main has PR-only and required-successful-check enforcement, stale-head handling
  where supported, and squash merge is the repository completion method.
- Each custom checker has negative tests and the project verification passes.

### Explicitly not included

Product features, API/DB code, integration/E2E suites for business flows and any
release-specific checker not yet justified by a real object.

## M1 — Running Application Shell

### Goal

Deliver the minimal real mobile, API and Admin foundation required for subsequent
vertical product capabilities.

### Outcome

The approved React Native/Expo mobile app, Node REST API and Next.js Admin can run as
one intentionally small vertical shell with shared engineering boundaries, health-level
operability and owner-manual Expo Go acceptance on a physical phone.

### Included capabilities

- Real app/API/Admin startup and composition roots;
- architectural module boundaries, trust-boundary validation and isolated test
  infrastructure only as required by the shell;
- a health-level operational surface, without business management functions.

### Dependencies

M0 and the accepted target technology stack.

### Critical contracts

`ARCH-001` through `ARCH-006`, `DATA-001`, `DATA-002`, `AUTO-009` and `SLICE-004`.

### Critical E2E

Developer starts the mobile app and API in the supported test environment
→ mobile reaches a real API health capability
→ Admin reaches its real shell
→ the owner manually verifies the mobile smoke flow in Expo Go; no product behavior is
simulated as a release capability.

### Exit criteria

- Each executable surface runs through its real composition root.
- Architecture and unit checks pass in CI; the owner accepts the mobile smoke scenario
  manually through Expo Go.
- The shell contains no speculative menu, auth, payment or database business model.

### Explicitly not included

Customer identity, catalog content, orders, Admin business CRUD, provider adapters
and a production-release claim.

## M2 — Customer Identity

### Goal

Deliver the Customer Identity milestone as a sequence of customer/profile foundation
tasks that can be developed with a strictly non-production test identity, while
preserving the approved production Phone + SMS OTP boundary for M13.

### Outcome

M2 is a multi-task milestone. Its intermediate tasks may establish customer/profile
foundations, minimum customer data and persisted legal acceptance while using the
non-production test identity. No M2 task creates production authentication, a production
session or order authorization; real production authentication remains a release gate in
M13. Cart preservation across that real authentication transition is completed with the
real cart in M4.

### Included capabilities

- An explicitly opt-in, local development/test identity path for mobile development;
- persisted customer/profile foundation, including profile completion and the minimum
  customer data required by the product contracts;
- required Privacy Policy and User Agreement acceptance, with its persisted record;
- other identity-dependent customer foundations that can be developed using the approved
  non-production test identity;
- a clear boundary that production authentication/session is implemented only in the
  final production-readiness/release stage;
- a documented task-level distinction: VPZH-016 is only the development/test identity
  foundation and does not implement the complete M2 milestone;
- VPZH-017's real PostgreSQL customer/profile vertical slice, using a backend boundary that
  is opt-in, non-production and fail-closed;
- VPZH-018's mobile Application port, validated API adapter and explicitly test-only
  backend-connected profile state, including safe failure and retry;
- VPZH-020's mobile profile editor over the existing PATCH contract, including safe save
  failure/retry and exact backend-returned persisted state;
- VPZH-021's persisted test-only Privacy Policy/User Agreement acceptance foundation, including
  document version, UTC acceptance timestamp and real HTTP/PostgreSQL/Mobile evidence;
- the account-deletion requirement is carried forward to M8, where it can correctly
  handle persisted order and financial records.

### Dependencies

M1. No SMS provider is required for the M2 development/test identity path. A concrete
SMS provider and the real Phone + SMS OTP implementation are required before M13
production-readiness/release completion.

### Critical contracts

Core Product Contracts section 6 (Authentication Boundary), `INV-002`, `SEC-004`,
`SEC-006` and `DATA-001`.

### Critical E2E

Developer/test runtime enables the explicit guard
→ customer enters a phone number
→ taps Continue
→ app creates an in-memory development identity state and shows loading
→ mobile sends the trimmed identity to the existing `GET /me/profile`
→ the backend test identity resolves a persisted customer/profile through PostgreSQL
→ mobile validates and shows the explicitly test-only backend-connected profile state
→ customer edits optional profile fields and sees only the persisted backend-returned update
→ VPZH-021 adds a separate test-only persisted legal-acceptance foundation
→ UI clearly identifies the path as test-only and not SMS authentication.

### Exit criteria

- The bypass is disabled by default and requires explicit development/test configuration.
- Production/release runtime disables the bypass even when its flag is accidentally true.
- Phone → Continue creates only in-memory development identity state, then VPZH-018 loads
  the existing backend profile; no production token/session/backend-auth state is created
  and a backend failure remains a visible error.
- VPZH-017 persists and reloads stable customer ID, phone, nullable name, optional birthday
  and timestamps through the real HTTP → Application → Domain → PostgreSQL path.
- VPZH-018 validates that profile through the shared contract and shows phone plus any
  existing name/birthday in a clearly test-only mobile state with retry.
- VPZH-020 persists edited nullable name/optional birthday through the existing PATCH path;
  save failure never appears successful and no globally required-name state is introduced.
- Legal acceptance is covered by VPZH-021 and remains absent from VPZH-017 itself.
- The production Phone + SMS OTP/provider/session flow is verified in M13 before release,
  with password, email, Apple and Google login absent.

### Explicitly not included

Real Phone + SMS OTP, OTP generation/verification, SMS provider integration, JWT or
other production tokens, production authentication/session, SecureStore credentials,
production backend auth middleware, production order authorization, cart preservation,
order creation, payment, account deletion completion, delivery addresses, individual
Admin accounts and any unapproved SMS provider choice. Customer/profile foundation,
minimum customer data and persisted legal acceptance are M2 capabilities, but are not
implemented by VPZH-016.

## M3 — Menu, Search and Availability

### Goal

Make the approved two-level catalog, local search and authoritative operational
availability useful to a guest and ready for checkout validation.

### Outcome

Customers can browse cached menu data and search category, name and ingredients; Admin
can manage first-release menu content and visibility, while the real iiko availability
adapter provides the operational source of truth.

### Included capabilities

- Category → Product catalog, product details and local search;
- Admin management of categories, products, prices, images and `admin_enabled`;
- cacheable browse behavior that never represents cached availability as checkout
  authority;
- real iiko stop-list/availability adapter and synchronization for
  `iiko_available`; M6 uses this adapter before payment and order submission, while M7
  adds the separate kitchen lifecycle-status synchronization.

### Dependencies

M1; M2 is not required for browsing. Accepted ADR-002 records the exact iiko API
contract before M3 implementation begins; VPZH-032 still defines the concrete
availability adapter within that contract.

### Critical contracts

Core Product Contracts sections 4 (Product Availability), 22 (Offline) and 23 (Admin
vs iiko Responsibility Boundary), plus `INV-006`.

### Critical E2E

Guest opens app
→ browses categories and products
→ searches by category and ingredient
→ sees product orderability determined by Admin visibility and current iiko
availability
→ loses connectivity
→ continues browsing cached menu but cannot begin checkout from stale data.

### Exit criteria

- Catalog has exactly the approved Category → Product depth.
- Search is local over the documented fields.
- Admin and mobile use real persisted menu content, not fixture-only content.
- The real iiko adapter, not cached mobile data, supplies operational availability for
  later checkout validation.
- The owner manually verifies browse/search/offline behavior through Expo Go; catalog and
  availability-adapter integration tests pass.

### Explicitly not included

Cart, checkout, payment, iiko order submission, kitchen lifecycle statuses, warehouse
inventory, modifiers, combos and claiming that cached availability authorizes an order.

### Current repository slices and status reconciliation

The committed repository baseline is `f1c51efa5b3c6e3d0eb65b9e526dff46bfb7db32`.
The current working tree also contains implementation work for the following tasks.
Implementation presence does not imply completion: the status stays `in_progress`
until the task acceptance criteria and mandatory verification pass.

| Task     | Current slice                                                                                                          | Status        | Current evidence/boundary                                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VPZH-029 | Product details and approved metadata through Backend, Admin and Mobile                                                | `in_progress` | `pnpm verify` passes; owner manual phone acceptance remains outstanding; dependency audit passes with the approved warning policy.                                       |
| VPZH-030 | Accepted ADR-004 Product imagery slice with Backend-controlled storage/serving                                         | `in_progress` | `pnpm verify` passes; owner manual image acceptance remains outstanding; dependency audit passes with the approved warning policy.                                       |
| VPZH-031 | Local catalog search over the loaded Backend-confirmed Mobile catalog                                                  | `completed`   | Mobile/API tests, full verification and owner manual search acceptance passed.                                                                                           |
| VPZH-036 | Fast/full verification selection, reverse workspace impact and additive CI routing                                     | `in_progress` | PRs and ordinary main pushes use incremental/fast checks; full verification is reserved for explicit stage closure.                                                      |
| VPZH-037 | Admin catalog visibility using `admin_enabled`                                                                         | `in_progress` | API/integration checks pass; owner manual hide/restore acceptance remains outstanding; no second visibility or orderability model exists.                                |
| VPZH-038 | Visual Mobile slice: Backend-driven catalog and local presentation/demo state for cart, roulette, passport and profile | `in_progress` | Mobile tests and full verification pass; owner manual phone acceptance remains outstanding; presentation/demo state has no production order/payment/reward side effects. |
| VPZH-039 | Visual Admin slice: prototype-aligned shell, live Backend Menu and non-mutating placeholders                           | `in_progress` | Admin tests and full verification pass; deferred sections, including Orders, have explicit owner/connection placeholders.                                                |

The current verification run passed with `VPZH_TEST_DATABASE_URL` set to the local
isolated `vpzh_test` database, including PostgreSQL integration and all build/checker
gates. Automated Android/Maestro device E2E is disabled by owner decision and is not a
completion gate; the owner performs Mobile acceptance manually through Expo Go on a physical
phone. `pnpm check:dependencies` now passes with pnpm 11.24.0; `pnpm audit --json`
terminates and still reports the known moderate `uuid` finding, while the existing
owner-approved image-size waiver remains explicit. The database must remain isolated;
mock, fixture, demo or fabricated audit data must not be used to turn these tasks green.

The reconciled task worktree completed VPZH-031 Local catalog search after its mandatory
checks and owner manual search acceptance passed. It uses only the already loaded
Backend-confirmed catalog and adds no API or database search boundary. VPZH-032 can be
prepared separately only after its adapter-level
decisions are recorded under accepted ADR-002.

## M4 — Cart, Authoritative Pricing and Favorites

### Goal

Turn catalog browsing into a durable cart capability with backend-authoritative price
validation and customer favorites.

### Outcome

Guests and authenticated customers can change quantities, add one order comment and
manage favorites; displayed totals are refreshed from authoritative current pricing
before checkout eligibility is claimed.

### Included capabilities

- Persisted guest cart, quantity and one shared order comment;
- favorites;
- current-price calculation and backend promo eligibility validation;
- Promo Admin CRUD for the approved percent, fixed and gift promos;
- the checkout design preserves the promo/ember mutual-exclusion invariant, but ember
  redemption is introduced only in M9;
- no minimum amount, tips, cutlery, service fee or packaging fee.

### Dependencies

M2 and M3.

### Critical contracts

`MON-001` through `MON-007`, Core Product Contracts sections 5 (Cart) and 16 (Promo),
plus `INV-001`, `INV-007` and `INV-013`.

### Critical E2E

Guest browses current menu
→ adds and changes product quantities and an order comment
→ closes and reopens app
→ sees retained cart
→ authenticates
→ sees the same cart with refreshed authoritative total
→ applies a valid current promo and sees the authoritative discounted total.

### Exit criteria

- Mobile-supplied totals are never trusted for a checkout transition.
- Promo Admin CRUD and backend promo validation work against real persisted data.
- The checkout contract preserves promo/ember mutual exclusion without a mock or
  placeholder ember balance; M9 adds real ember redemption.
- Unit tests cover monetary invariants; API integration passes and the owner accepts the
  customer cart flow manually through Expo Go.

### Explicitly not included

Pickup choice, payment, order creation, repeat order (which depends on completed-order
history), ember redemption, tips/fees and modifiers/combos.

## M5 — Pickup Checkout

### Goal

Give an authenticated customer a validated pickup checkout before payment begins.

### Outcome

An eligible cart can choose ASAP or a same-day hourly pickup slot at the one approved
restaurant; an ineligible cart is corrected before payment.

### Included capabilities

- One fixed Краснодар pickup location;
- ASAP and current-day scheduled hourly slots;
- backend checkout precondition and current availability recheck;
- offline prevention at checkout and payment boundary.

### Dependencies

M2, M3 and M4. The exact 21:30–22:00 closing-boundary algorithm is required before
the task that implements that boundary.

### Critical contracts

`CHK-001` through `CHK-009`, Core Product Contracts section 8 (Pickup Time), plus
`INV-003`, `INV-006` and `INV-014`.

### Critical E2E

Authenticated customer with a valid cart
→ chooses ASAP or an allowed current-day slot
→ backend recalculates price and rechecks availability
→ reaches payment initiation only when every checkout precondition holds.

### Exit criteria

- No branch selection, delivery or next-day pickup appears.
- Invalid price, promo, availability, authentication, time or offline state blocks
  payment initiation with a clear correction path.
- Checkout integration tests pass and the owner accepts the customer scenario manually
  through the supported client flow.

### Explicitly not included

SBP provider interaction, payment confirmation, iiko submission and the unapproved
exact closing-boundary algorithm.

## M6 — SBP Payment and Order Acceptance

### Goal

Create the durable paid-order path from a valid pickup checkout through provider
confirmation and truthful kitchen acceptance.

### Outcome

A valid authenticated checkout can complete online SBP payment; only backend-persisted
confirmation enables iiko submission, and the customer sees no false acceptance.

### Included capabilities

- SBP payment initiation, provider callback/webhook handling and idempotency;
- persisted payment/order states including expiry and failure;
- authoritative pre-payment iiko availability check and initial iiko submission;
- customer-visible `paid` and acknowledged acceptance boundary.

### Dependencies

M5. Accepted ADR-002 supplies the iiko API contract; concrete SBP provider, exact
payment expiration timeout and exact `accepted` semantics remain decisions required
before their relevant implementation tasks.

### Critical contracts

Core Product Contracts sections 9 (Payment Lifecycle), 10 (Order Lifecycle), 11 (iiko
Submission) and 12 (iiko Failure), plus `INV-004`, `INV-005`, `INV-010` and `REL-003`.

### Critical E2E

Authenticated customer
→ completes a valid pickup checkout
→ completes SBP payment
→ backend persists provider confirmation
→ submits order to iiko
→ iiko acknowledges
→ customer sees accepted kitchen status only after acknowledgement.

### Exit criteria

- Unpaid, failed or expired payment never reaches iiko.
- Duplicate provider events cannot create duplicate payment/order effects.
- Real provider-contract and iiko-adapter integration tests cover success, failure and
  idempotency; the supported mobile E2E proves the happy path.

### Explicitly not included

Ongoing cooking/ready/completed status, customer cancellation, refund handling and
provider-specific behavior not fixed by the accepted ADR-002 contract.

## M7 — Kitchen Lifecycle and Order History

### Goal

Complete the iiko-owned operational order lifecycle after truthful acceptance.

### Outcome

Customers and Admin can see accurate cooking, ready-for-pickup and completed states,
while every transition is durably recorded and iiko retains kitchen authority.

### Included capabilities

- iiko status synchronization for cooking, readiness and completion;
- customer order history and status presentation;
- Admin order observation, integration-error diagnostics and transition history;
- repeat order preparation using current price and availability.

### Dependencies

M6 and the accepted ADR-002 iiko contract.

### Critical contracts

Core Product Contracts sections 10 (Order Lifecycle), 15 (Order History) and 23 (Admin
vs iiko Responsibility Boundary), plus `INV-011`, `INV-012` and `INV-013`.

### Critical E2E

Paid and iiko-acknowledged order
→ iiko reports cooking
→ reports ready for pickup
→ reports completed
→ customer and Admin see ordered history
→ customer starts repeat order and corrects any current unavailable item before checkout.

### Exit criteria

- iiko is the operational source for kitchen execution states.
- Each persisted transition includes from, to, timestamp and source/actor.
- Admin observes rather than duplicates kitchen actions.
- Integration tests pass and the owner accepts the order-history flow manually through the
  supported client flow.

### Explicitly not included

Customer cancellation/refunds, loyalty awards before the dedicated reward slice and
manual business-data changes by super admin.

## M8 — Cancellation, Refund and Reliability

### Goal

Make exceptional order and payment paths truthful, recoverable and visible to the
right operators.

### Outcome

Eligible customers can cancel before cooking; paid cancellation and unrecoverable
paid-to-iiko failures lead to full refund handling without false accepted status.
The first-release account-deletion capability also completes here, after customer
orders and financial records exist.

### Included capabilities

- Cancellation permissions, stable reasons and customer-readable outcomes;
- refund state handling, automatic refund for unrecoverable iiko submission failure;
- bounded safe retries, durable failure records and critical alert visibility;
- Telegram alert and super-admin visibility for failed refunds.
- account deletion that deletes or anonymizes PII while retaining financial/order data
  only in an anonymized or otherwise legally permitted form.

### Dependencies

M2, M6 and M7. Provider refund behavior is required before its adapter implementation.

### Critical contracts

Core Product Contracts sections 12 (iiko Failure), 13 (Cancellation), 14 (Refund) and
25 (Failure Matrix), Product Definition section 8 (Legal Documents, Consent and
Account Deletion), plus `INV-009`, `INV-010` and `REL-001` through `REL-007`.

### Critical E2E

Customer with paid accepted order before cooking
→ cancels
→ backend records `customer_request`
→ full refund succeeds
→ customer sees cancellation/refund outcome; a simulated provider refund failure
creates the required critical alert and super-admin visibility.

Authenticated customer requests account deletion
→ backend deletes or anonymizes PII according to the approved retention boundary
→ permissible order/financial history remains non-identifying
→ the former customer can no longer access the account.

### Exit criteria

- Customer cancellation at or after cooking is forbidden.
- All retry behavior is bounded and protected against non-idempotent repetition.
- Payment-success/iiko-failure and refund-failure integration scenarios pass.
- The owner accepts the customer cancellation path manually through the supported client flow.
- Account deletion completes with integration/security evidence that PII is removed or
  anonymized and retained financial/order data cannot identify the customer.

### Explicitly not included

New payment options, manual kitchen operations, delivery cancellation or an unspecified
provider refund API behavior.

## M9 — Loyalty, Embers, XP and Ranks

### Goal

Award and manage the approved core loyalty progression only after real order
completion.

### Outcome

Completed orders grant configured embers and XP/rank effects; cancelled or refunded
orders do not retain rewards, and Admin can make audited ember adjustments.

### Included capabilities

- Ember redemption boundary and configured maximum;
- cashback/embers, XP and rank configuration;
- completion-triggered award and cancellation/refund reversal;
- Admin loyalty operation with amount, reason, actor and timestamp for ember changes.

### Dependencies

M7 and M8.

### Critical contracts

Core Product Contracts sections 17 (Ember) and 18 (XP and Rank), plus `INV-007`,
`INV-008` and `MON-004`.

### Critical E2E

Customer completes an eligible order
→ backend awards configured embers and XP
→ profile and Admin show the resulting balance/rank
→ a later refund reverses the applicable award according to the contracts.

### Exit criteria

- No reward is granted before `completed`.
- Promo and embers remain mutually exclusive at checkout.
- Loyalty-award and reversal integration tests pass; the owner accepts earned-balance
  visibility manually through the supported client flow.

### Explicitly not included

Unapproved rank benefits, wheel spins, quests, marketing segmentation and manual XP
adjustment.

## M10 — Wheel and Quests

### Goal

Add the approved completed-order gamification capabilities without weakening their
reward invariants.

### Outcome

Eligible completed orders can yield one configured wheel spin and customers can make
automatic progress on configured quests.

### Included capabilities

- Wheel eligibility, one non-accumulating spin and always-present reward;
- Admin wheel rewards/probabilities;
- quest conditions, progress, date windows and automatic rewards;
- Admin quest configuration.

### Dependencies

M9. The wheel threshold interaction with ember redemption is a decision required before
the relevant eligibility implementation.

### Critical contracts

Core Product Contracts sections 19 (Wheel) and 20 (Quest), plus `INV-015` and
`INV-008`.

### Critical E2E

Customer completes a qualifying order
→ receives no more than one available wheel spin
→ spins and receives a configured reward
→ completes a qualifying quest condition
→ sees automatically awarded quest reward.

### Exit criteria

- A spin is never accumulated and never produces no reward.
- Wheel and quest rewards respect completed-order boundaries and concurrency rules.
- Reward integration tests pass and the owner accepts the gamification scenario manually
  through the supported client flow.

### Explicitly not included

The unresolved wheel/ember threshold rule, segments, push campaigns and new reward
types beyond the approved set.

## M11 — Segments, Push and Messaging

### Goal

Deliver the approved transactional and marketing messaging capability using customer
segments while preserving the unresolved consent issue.

### Outcome

Customers receive supported transactional status communication, while Admin can target
the approved marketing campaigns to segments only under an owner-resolved preference
model.

### Included capabilities

- Customer segments and Admin segment management;
- transactional push for approved payment/order/refund events;
- Admin marketing push campaigns for approved categories and segments;
- SMS restricted to OTP.

### Dependencies

M2, M7, M8 and M10. The marketing-consent/notification-preference conflict requires
owner decision before marketing messaging completion.

### Critical contracts

Core Product Contracts section 21 (Notification) and Product Definition sections 17
(Segments) and 21 (Push / SMS), plus `SEC-005` and the marketing-consent TBD.

### Critical E2E

Customer pays and receives an approved transactional status update
→ Admin selects an eligible segment
→ sends an approved marketing campaign
→ only customers permitted by the resolved consent policy receive it.

### Exit criteria

- Transactional event set matches the approved contract.
- SMS is used only for OTP and email is absent.
- Marketing completion does not ship until the consent conflict is explicitly decided.
- Provider contract/integration tests pass; the owner accepts notification handling manually
  where the platform supports the scenario.

### Explicitly not included

An invented marketing-preference rule, email campaigns, delivery messaging or unrelated
CRM functionality.

## M12 — Admin Completion, Analytics and Health

### Goal

Complete the approved operational Admin capabilities, analytics and lightweight health
observability across the already delivered customer capabilities.

### Outcome

Admin can operate approved business data and view business analytics; super admin can
observe health and incidents without gaining business-data mutation powers.

### Included capabilities

- Admin Dashboard, Menu, Promos, Customers, Loyalty, Quests, Wheel, Segments and
  Messages completion;
- approved analytics funnel and business measures;
- order/refund/payment/iiko diagnostics and lightweight API, PostgreSQL, SBP, iiko,
  SMS and push health;
- super-admin observer boundary.

### Dependencies

M3, M7 through M11. Admin authentication mechanism is required before implementing
Admin authentication. Provider and health checks use decisions already made for their
relevant integrations.

### Critical contracts

Product Definition sections 22 (Admin) and 23 (Analytics), Core Product Contracts
section 23 (Admin vs iiko Responsibility Boundary), plus `INV-012` and `SEC-004`.

### Critical E2E

Admin updates an approved menu/promo/loyalty configuration
→ customer capability uses the allowed resulting data
→ Admin observes resulting order/payment history and analytics
→ super admin sees a simulated critical integration incident but cannot mutate business
data.

### Exit criteria

- Admin never performs iiko-owned kitchen execution.
- Super admin remains an observer for business data.
- Admin authorization/security, analytics integration and critical admin E2E scenarios
  pass.

### Explicitly not included

Individual Admin account design before its owner decision, a large technical console,
warehouse inventory, user blocking, multi-restaurant administration or delivery ops.

## M13 — Production Readiness and First Release

### Goal

Prove the integrated first-release capability is safe, compatible and operable for a
real one-location pickup launch without introducing a deployment-provider decision.

### Outcome

The complete approved customer and Admin journey has release-grade evidence across
mobile, API, database, providers and operational failure paths.

### Included capabilities

- Real Phone + SMS OTP customer authentication, including the provider integration;
- production session/token treatment and the authenticated-customer boundary;
- required legal acceptance and its security/integration/E2E evidence;
- Complete owner-approved manual acceptance for browse, authentication, cart, checkout,
  payment, order lifecycle, cancellation/refund, loyalty/gamification and relevant push flows;
- API compatibility, contract, security, migration, SQL-safety, dependency and secret
  checks;
- isolated DB migration validation and release build verification;
- payment, iiko, refund, offline, Admin and health failure evidence;
- measured critical-path performance budgets and smoke verification;
- removal or technical production-runtime exclusion of every development/test identity
  bypass.

### Dependencies

M0 through M12 and all provider/behavior decisions required by the implemented
capabilities. No deployment provider is selected by this roadmap.

### Critical contracts

All applicable critical invariants `INV-001` through `INV-015`, `API-001` through
`API-006`, `DB-001` through `DB-008`, `SEC-001` through `SEC-008`, `DOD-001` through
`DOD-008` and the release gates planned in `AUTOMATION.md`.

### Critical E2E

Guest browses menu
→ adds products and authenticates by OTP
→ selects valid pickup
→ pays by SBP
→ backend submits to iiko and receives acknowledgement
→ customer observes completion
→ eligible rewards appear; failure scenarios prove no false acceptance, correct refund
handling, offline checkout prevention and required operator visibility.

### Exit criteria

- `verify:milestone`/`verify:release` and all applicable first-release gates pass.
- Owner-approved manual acceptance, integration/contract/security/migration tests and
  release smoke all pass in the supported release environment.
- Public API compatibility, database migration behavior and failure handling are
  evidenced rather than assumed.
- No delivery, reviews, multiple locations or unapproved product behavior is included.

### Explicitly not included

Delivery implementation, post-release expansion, a named deployment provider or an
automatic declaration that production release is complete without owner release review.

## 4. First Milestone: Next Task Proposals

These are the only proposed next tasks. They deliberately implement the existing
`AUTOMATION.md` PR-policy backlog in coherent pieces; they are proposals, not task
manifests, and must receive their own Definition of Ready.

### VPZH-005 — Enforce deterministic active task and task contract

**Goal:** Implement `check:task-contract` with explicit `TASK_ID=VPZH-XXX`; validate
the selected manifest against the schema and required DoR without inferring it from
manifest status.

**Why now:** Product tasks cannot be safely automated while the active task is
ambiguous.

**Scope:** Task-ID input/validation, schema/DoR checker, documented local/CI use and
negative tests for missing, invalid and incomplete selected manifests.

**Out of scope:** Scope/diff checks, secrets, dependencies, `verify:pr`, GitHub
rulesets and any product task.

**Dependencies:** VPZH-001 foundation and existing task schema.

**Acceptance idea:** `TASK_ID=VPZH-XXX` resolves only
`docs/tasks/VPZH-XXX.yaml`; a branch name may be checked but cannot become identity.

**Required verification:** Existing `pnpm verify`, checker negative tests and a
deterministic CI/local invocation.

**Critical negative tests:** Missing `TASK_ID`, absent selected manifest, schema-invalid
manifest and an incomplete DoR all fail.

**Expected size band:** Small-to-medium engineering slice, normally 500–1500
meaningful lines.

### VPZH-006 — Enforce task scope and meaningful diff size

**Goal:** Implement `check:task-scope` and `check:diff-size` for the explicit active
task.

**Why now:** The repository needs a technical barrier against accidental scope creep
and oversized diffs before product implementation begins.

**Scope:** Git diff/base handling, declared-path glob matching, meaningful-diff
classification and documented warning/hard-fail behavior.

**Out of scope:** Task identity/DoR validation beyond consuming VPZH-005, secrets,
dependencies, PR CI aggregation and product code.

**Dependencies:** VPZH-005.

**Acceptance idea:** Every changed file must match `scope.paths`; generated files,
lockfiles and snapshots are reported separately and cannot hide a >3000 meaningful-line
violation.

**Required verification:** Existing `pnpm verify`, negative checker tests using
isolated Git fixtures and CI-compatible base-ref behavior.

**Critical negative tests:** Out-of-scope path yields `TASK_SCOPE_VIOLATION`; generated
noise cannot hide oversized meaningful changes; missing base configuration is checker
error rather than false pass.

**Expected size band:** Medium engineering slice, normally 800–1800 meaningful lines.

### VPZH-007 — Add secret scanning and dependency hygiene

**Goal:** Implement `check:secrets` and `check:dependencies` for repository and PR
diff safety.

**Why now:** Secrets and unsafe dependency changes can enter before API or database
work exists.

**Scope:** Repository/PR-diff secret scan, fake-value fixture convention, lockfile and
package-manager consistency, dependency hygiene and security-audit integration.

**Out of scope:** Automatic dependency updates, product/provider credentials, task
scope checking, `verify:pr` aggregation and external API work.

**Dependencies:** VPZH-005 for explicit task context where the PR command requires it;
VPZH-001 package/lockfile foundation.

**Acceptance idea:** A committed credential-like value or inconsistent/policy-violating
dependency state fails; allowed examples remain clearly fake.

**Required verification:** Existing `pnpm verify`, deterministic checker tests and
negative fixture tests that cannot contain usable secrets.

**Critical negative tests:** Fake key/token-shaped fixtures produce violations without
real credentials; package/lockfile mismatch and pinned-package-manager bypass fail.

**Expected size band:** Medium engineering slice, normally 800–1800 meaningful lines.

### VPZH-008 — Unify PR verification and CI

**Goal:** Implement `verify:pr` and make PR CI run the same mandatory command.

**Why now:** Separate local and CI paths allow gates to silently diverge.

**Scope:** Ordered `verify:pr` entrypoint, `TASK_ID` CI contract, workflow wiring and
automation/policy synchronization for the implemented commands.

**Out of scope:** GitHub branch/ruleset configuration, new business tests or changing
the semantics of the individual checkers.

**Dependencies:** VPZH-005, VPZH-006 and VPZH-007.

**Acceptance idea:** PR CI invokes `pnpm verify:pr`; it runs `verify` followed by task
contract, task scope, diff size, secrets and dependency checks, stopping on a mandatory
failure.

**Required verification:** Existing `pnpm verify`, `pnpm verify:pr`, checker-exit
contract tests and a successful GitHub Actions PR run.

**Critical negative tests:** A failing constituent checker makes `verify:pr` non-zero;
missing `TASK_ID` in CI fails rather than choosing a manifest.

**Expected size band:** Small-to-medium engineering slice, normally 500–1200
meaningful lines.

### VPZH-009 — Enforce GitHub PR policy for main

**Goal:** Configure repository-level technical enforcement for PR-only completion of
tasks on `main`.

**Why now:** Scripts alone cannot prevent accidental direct push or merge after a
changed head.

**Scope:** GitHub branch protection/ruleset settings for PR requirement, successful
required `verify:pr`, changed-head/stale-review handling where supported and squash
merge policy; documented evidence of applied configuration.

**Out of scope:** Product implementation, new checkers, deployment policy and a
replacement governance model.

**Dependencies:** VPZH-008 and GitHub permissions/settings availability.

**Acceptance idea:** Direct push to `main` is technically rejected; a PR with failing
or stale mandatory verification cannot merge; squash is the approved completion path.

**Required verification:** Repository settings evidence plus a safe non-destructive
check that required PR gates are active; `pnpm verify` remains green.

**Critical negative tests:** A controlled policy/evidence check detects absent required
status enforcement; no direct-push test may alter `main`.

**Expected size band:** Small configuration-focused slice, normally 500–1000
meaningful lines excluding provider-generated evidence.

## 5. Decisions Required Before Future Milestones

| Decision                                               | Required before                                    | Reason roadmap cannot resolve it                                                                                               |
| ------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Concrete SMS provider                                  | M13 final production-readiness/release task        | Real SMS OTP is intentionally deferred; Product Contracts still require it in production.                                      |
| Exact iiko API and integration details                 | Resolved by accepted ADR-002 before M3             | ADR-002 fixes auth, M3 operational endpoints, mapping and fail-safe boundaries; task-level adapter details remain in VPZH-032. |
| Exact pickup closing-boundary algorithm (21:30–22:00)  | M5 pickup-time boundary task                       | Approved behavior deliberately leaves the edge algorithm `TBD`.                                                                |
| Concrete SBP provider                                  | M6 payment provider task                           | First release requires SBP, not a provider choice.                                                                             |
| Exact payment expiration timeout                       | M6 expiry behavior task                            | Only an approximate 10–15 minute expectation is approved.                                                                      |
| Exact `accepted` semantics                             | M6 customer state presentation / M7 lifecycle task | Customer cannot be misled, but the precise semantic definition remains `TBD`.                                                  |
| Provider-specific refund behavior                      | M8 refund adapter task                             | Full-refund outcome is required; provider mechanics are not chosen.                                                            |
| Additional rank benefits beyond cashback               | Relevant M9 benefit task                           | Only cashback is confirmed.                                                                                                    |
| Wheel threshold interaction with ember redemption      | Relevant M10 eligibility task                      | The threshold basis is approved, this interaction is not.                                                                      |
| Marketing consent and notification-preference conflict | M11 marketing-messaging completion                 | Current decisions conflict and need owner resolution.                                                                          |
| Admin authentication mechanism                         | M12 Admin-authentication task                      | Shared Admin account is approved; its authentication mechanism is `TBD`.                                                       |
| Modifiers and combo/set rules                          | A later dedicated capability, if approved          | Their structure, pricing and constraints are not defined.                                                                      |

Future delivery needs a separate product decision and technical planning; it does not
block any first-release milestone because it is not first-release scope.

## 6. Post-release / Future

- Delivery, following a separate product decision and roadmap rather than extending
  pickup-only first-release behavior implicitly.
