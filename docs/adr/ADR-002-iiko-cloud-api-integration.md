# ADR-002: iiko Cloud API integration contract

- Status: Accepted
- Date: 2026-08-24
- Owner approval: Approved — explicit owner command `APPROVE ADR-002` on 2026-08-24
- Scope: M3 operational availability; reusable authentication and restaurant
  context for later milestones

## Context

The M3 execution plan makes the exact iiko API and integration contract a
pre-M3 gate. M3 must provide operational availability and stop-list behavior,
but our Admin / Backend / PostgreSQL remains authoritative for Category, Product,
menu content, name, description/ingredients, price, image and `admin_enabled`.
iiko is not the canonical catalog and is not allowed to take ownership of our
Product entity.

This ADR records the accepted owner decision. It does not implement an iiko
adapter, change production code, provision credentials or perform provider writes.

## Sources Verified

Official iiko Cloud API sources were checked on 2026-08-24. The official ReDoc
page is [https://api-ru.iiko.services/docs](https://api-ru.iiko.services/docs),
and its machine-readable document is
[https://api-ru.iiko.services/api-docs/docs](https://api-ru.iiko.services/api-docs/docs).
The official HTTP `Date` observed while retrieving the OpenAPI document was
`2026-08-24T14:01:57Z`.

| Evidence                        | Result                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| OpenAPI format                  | `3.0.1`                                                                                           |
| OpenAPI `info.version`          | Empty in the retrieved document; no provider version string was published there                   |
| Embedded DTO assembly reference | `9.8.2.2` in the current document's schema references                                             |
| Retrieved OpenAPI SHA-256       | `7380569a718ad38f7ffa646eff67132a5ebeac5fbcc857f6fb9e9b0743e5f42b`                                |
| Simulator repository            | `/Users/rotman/Desktop/vse-pro-zhar-iiko-simulator` at `d0bef571f8487869236883c770dab4cfae30fbe6` |
| Simulator upstream snapshot     | Same official URL and same SHA-256 as the retrieved document                                      |
| Simulator source retrieval      | `2026-08-23T23:56:10Z`, recorded in its `contracts/upstream/SOURCE.md`                            |

The simulator repository was inspected read-only. It is a deterministic
development/test substitute backed by the public schema. Its own status keeps
real-iiko verification pending until sanitized real-account captures exist.

For the legacy authentication wording, the retrieved official OpenAPI document
at [the machine-readable source](https://api-ru.iiko.services/api-docs/docs)
contains the following evidence for `POST /api/1/access_token`: the operation
has `deprecated: true`, and its description is "Deprecated: use
/api/v2/access_token instead." The same operation remains published with its
legacy `apiLogin` request schema. The document does not publish a disable date
or cutoff.

## Decision

### API family and base URL

Use the iiko Cloud API at the configured `IIKO_BASE_URL`; the production value
for the Russian account is `https://api-ru.iiko.services`. Local development and
tests may point the same adapter at the standalone simulator. The domain and
environment configuration belong to the Backend integration boundary, never to
Domain code and never to Mobile.

The current OpenAPI exposes the M3 operational endpoints under `/api/1`, while
the current authentication endpoint is under `/api/v2`. This proposal does not
upgrade operational endpoints to an invented `/api/v2` variant.

### Authentication

Select the current application-auth endpoint as the production contract because
the official documentation provides application onboarding with `apiKey`,
`appId` and `clientSecret`, returns a JWT and documents a one-hour token with no
refresh-token flow:

| Item             | Contract                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Path             | `/api/v2/access_token`                                                                                                  |
| Method           | `POST`                                                                                                                  |
| JSON body        | `apiKey`, `appId`, `clientSecret`; all three are required and no other fields are allowed by the published schema       |
| `apiKey`         | API key generated in iikoWeb under Integrations → API Keys                                                              |
| `appId`          | Application identifier issued by the iiko Developer Portal; the published schema marks it as UUID-formatted             |
| `clientSecret`   | Application secret issued by the Developer Portal and stored only in Backend secret storage                             |
| Success response | `token` and `correlationId`; the token is a JWT session token valid for one hour according to the current documentation |
| Subsequent calls | `Authorization: Bearer {token}`                                                                                         |
| Refresh          | No refresh-token flow; obtain a new token before expiry or after an authentication failure                              |

The published legacy contract remains available for compatibility reference, but
this project makes the following architectural decision:

| Legacy item           | Policy                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/1/access_token` | Published legacy `POST` contract with `apiLogin`; the retrieved schema also contains the provider deprecation metadata recorded above |
| Cutoff status         | No disable date or cutoff is published in the retrieved official document                                                             |
| Our architecture      | Compatibility/test only; it is not the production authentication contract                                                             |

### M3 endpoint set

The following is the minimum proposed set. Every request uses the issued Bearer
token and the documented `Timeout` header, and every response is runtime
validated before any application/domain use.

| Endpoint                               | Requiredness                              | Purpose and call point                                                                                                                            | Identifiers and authoritative result                                                                                                                                                                    | Failure meaning                                                                              |
| -------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `POST /api/1/organizations`            | Mandatory                                 | Validate configured restaurant context during integration startup/configuration validation and when the context is revalidated                    | Request `organizationIds: [IIKO_ORGANIZATION_ID]`; response must contain the configured organization with a valid UUID and an enabled organization under `includeDisabled: false`                       | Configuration/context invalid; no operational availability may become available              |
| `POST /api/1/terminal_groups`          | Mandatory                                 | Validate that the configured terminal group belongs to the configured organization; refresh only when the integration needs to revalidate context | Request `organizationIds: [IIKO_ORGANIZATION_ID]`; response supplies terminal-group identity and organization relationship                                                                              | Configuration/context invalid; no operational availability may become available              |
| `POST /api/1/terminal_groups/is_alive` | Mandatory for an M3 availability snapshot | Check whether the configured terminal group is available to process requests as part of a refresh                                                 | Request `organizationIds: [IIKO_ORGANIZATION_ID]`, `terminalGroupIds: [IIKO_TERMINAL_GROUP_ID]`; use the matching `isAliveStatus` entry                                                                 | Missing, false or invalid liveness means the effective availability is not available         |
| `POST /api/1/stop_lists`               | Mandatory for an M3 availability snapshot | Pull the current operational out-of-stock state as part of periodic synchronization                                                               | Request `organizationIds: [IIKO_ORGANIZATION_ID]`, `terminalGroupsIds: [IIKO_TERMINAL_GROUP_ID]`; response contains `terminalGroupStopLists` and stop-list items with `productId` and optional `sizeId` | No valid snapshot; effective availability is unknown/not available, never silently available |

`POST /api/1/organizations` is preferred over the deprecated `GET` operation at
the same path. The organization request should use `includeDisabled: false` and
may request only the fields needed for context validation; M3 does not need
`/api/1/organizations/settings`.

The `is_alive` endpoint is included deliberately. A stop-list response tells us
which mapped items are operationally stopped, but does not by itself establish
that the configured terminal group is available to process requests. M3
availability therefore requires both a valid liveness result and a valid
stop-list result. No terminal-group wake-up or other write endpoint is part of
M3.

### Product ↔ iiko mapping

Our `Product` remains owned by Our Admin / Backend / PostgreSQL. The integration
boundary owns a conceptual mapping from our Product to the iiko stop-list item:

- required external identifier: iiko `productId` (UUID);
- optional external size discriminator: iiko `sizeId` (UUID) when the mapped
  product representation is size-specific;
- mapping ownership: our Backend integration/configuration boundary;
- persistence: the mapping must be persisted or otherwise durably configured by
  our system before a Product can receive `iiko_available = true`; the exact
  storage mechanism is an implementation task and is not designed here;
- requirement: a valid mapping is required for Product availability;
- missing mapping: availability is `unknown`, with effective orderability false;
- invalid, unmapped or provider-unknown identifier: availability is `unknown`,
  with effective orderability false.

For a valid mapping, an item matching the mapped `productId` and applicable
`sizeId` in the configured terminal group's stop list is operationally stopped.
An absent matching item can be considered operationally available only when the
context, liveness and stop-list snapshot are all valid and fresh. The provider's
`balance` field is consumed only as part of the validated stop-list contract; it
does not create a warehouse-inventory model in our system.

The resulting customer-facing rule remains:

```text
product_is_orderable = admin_enabled AND iiko_available
```

No iiko menu, nomenclature, product name, price, image or category response may
populate or override our Product model.

### Organization and terminal context

Production has one physical restaurant at Краснодар, ул. Бабушкина, 181. This
proposal does not introduce a multi-restaurant platform. The address is a
business constraint for owner/configuration review, not a reason to hardcode a
provider UUID in Domain.

The configured identifiers are:

- `IIKO_ORGANIZATION_ID`: the one allowed iiko organization UUID;
- `IIKO_TERMINAL_GROUP_ID`: the one allowed iiko terminal-group UUID belonging to
  that organization.

At configuration validation, the adapter must verify that the organization is
returned for the configured account, is enabled, and matches exactly the
configured ID. It must verify that the terminal group is returned for that
organization and matches exactly the configured terminal-group ID. A mismatch,
missing identifier or malformed response fails closed. Simulator IDs are
fixtures only and are never production configuration.

## M3 Contract

A future M3 availability adapter must:

1. authenticate through `POST /api/v2/access_token` using Backend-held
   `apiKey`, `appId` and `clientSecret`;
2. validate the configured organization and terminal group through the two
   dictionary endpoints;
3. periodically pull `POST /api/1/terminal_groups/is_alive` and
   `POST /api/1/stop_lists` for the configured context;
4. validate the full external response at the trust boundary;
5. match only persisted valid Product mappings to stop-list items;
6. expose an availability state that distinguishes `fresh`, `stale` and
   `unknown`; and
7. make failure, stale data, unknown mapping and invalid context unable to
   produce effective `iiko_available = true`.

The synchronization model is Backend pull. The stop list is the operational
source for item-level availability and terminal liveness is a required context
signal. The exact polling interval, retry budget, snapshot schema and storage
technology remain implementation-level decisions. They must not weaken the
freshness or fail-safe rules in this ADR.

## Freshness and Failure Semantics

The adapter may retain the last valid snapshot for diagnostics and recovery, but
its effective state must be explicit:

- `fresh`: the last complete, runtime-validated context/liveness/stop-list result
  is within the implementation-defined freshness policy; a valid mapping may
  produce `iiko_available = true` only if the terminal is alive and the mapped
  item is absent from the stop list;
- `stale`: a previously valid result is older than that policy; it may be shown
  as stale for diagnostics, but effective availability is false/not orderable;
- `unknown`: there is no valid result, the context is invalid, the mapping is
  absent/invalid, or the provider result cannot be trusted; effective availability
  is false/not orderable.

External failure includes timeout, connection failure, non-success HTTP status,
authentication failure, malformed JSON, schema drift, missing required fields,
identifier mismatch and an incomplete response for the configured context. All
of these fail safe. None may silently retain or synthesize `available = true`.

The adapter must preserve REL-001: every external HTTP call has a bounded
timeout. It must preserve DATA-001: every iiko request and response is untrusted
boundary data and is runtime validated. Provider error payloads are translated
to safe internal/application errors; raw provider bodies, tokens and secrets are
not leaked through our public API.

## Security

Credential names and ownership are part of this proposal; values are not.

- `IIKO_API_KEY`, `IIKO_APP_ID` and `IIKO_CLIENT_SECRET` are Backend integration
  credentials owned by the deployment/secret-storage boundary. The client
  secret and API key must not be committed, returned to Mobile or stored in
  frontend configuration.
- `IIKO_BASE_URL`, `IIKO_ORGANIZATION_ID` and `IIKO_TERMINAL_GROUP_ID` are
  environment/configuration concepts. Production must use the approved HTTPS
  iiko host; local tests may use the loopback simulator.
- Secrets, Bearer tokens and provider payloads containing credentials must not be
  logged. Correlation IDs may be retained for bounded internal diagnostics only.
- No real credential, token, real-account capture or provider write operation is
  part of this proposal.

## Simulator Role and Verification Status

The standalone simulator at commit
`d0bef571f8487869236883c770dab4cfae30fbe6` models the proposed contract's
current-auth endpoint, legacy compatibility endpoint, organizations, terminal
groups, terminal liveness, stop lists, stable fixture identifiers and relevant
fault modes. Its scenarios include empty/partial/all stop lists, terminal
offline, invalid/expired token, timeout, connection drop, malformed JSON and
schema-drift cases. It is suitable for deterministic development and contract
tests only.

The simulator's pinned upstream OpenAPI file has the same SHA-256 as the
official document retrieved for this ADR. The chosen M3 paths and their request
and response shapes therefore have no observed public-schema discrepancy.
That comparison does not establish production behavior: simulator identifiers,
latency, rate limits, error wording and closed-account behavior are not real
iiko observations.

```text
PUBLIC_SCHEMA_VERIFIED: yes
REAL_CAPTURE_VERIFIED: no
```

`REAL_CAPTURE_VERIFIED` remains `no` because no sanitized real-account captures
or real credentials are available. The simulator must remain read-only for this
task and must not be treated as production truth.

## Explicitly Deferred

- M6 order submission and any iiko write operation;
- M7 kitchen status/lifecycle synchronization;
- payment, checkout and cart;
- iiko External Menu, nomenclature or any provider catalog ownership;
- exact polling cadence, timeout values, retry policy and durable snapshot schema;
- real credential provisioning, account onboarding and provider operational setup;
- real-account capture/conformance work;
- multi-restaurant or multi-terminal-group platform behavior;
- SQL schema design for Product mappings.

## Alternatives Considered

### Legacy authentication as the production contract

Rejected as this project's production contract. The current official
documentation provides the v2 application-auth onboarding with `apiKey`,
`appId` and `clientSecret`, a JWT response and no refresh-token flow. The
retrieved schema also records provider deprecation metadata for the published
legacy operation, but compatibility/test-only treatment is our architectural
decision; no provider cutoff is inferred.

### External Menu as the canonical catalog

Rejected. Product Definition and the M3 plan assign category, product content,
price, images and Admin visibility to our Backend. External Menu may be useful
for future completeness or provider-specific order construction, but importing
it as canonical would transfer ownership and violate that boundary.

### iiko nomenclature as our Product model

Rejected. Our Product needs a stable local identity, Admin visibility and local
content independent of provider availability. The iiko `productId` is only an
integration mapping key for operational stop-list matching.

### Standalone iiko foundation before a canonical Product exists

Rejected as a separate feature. Organization and terminal context validation is
part of the future availability adapter contract, but a full provider foundation
before our Product mapping target exists would expand scope without enabling the
M3 user capability.

### Stop list without terminal liveness

Rejected. A valid stop-list payload does not alone establish that the configured
terminal group is available to process requests. M3 availability requires the
separate current `is_alive` signal.

### Simulator as production truth

Rejected. It is a public-schema-backed deterministic substitute with synthetic
identifiers. It cannot establish real-account behavior without sanitized
captures and explicit conformance comparison.

## Consequences

Positive:

- M3 has a precise current-auth and `/api/1` operational endpoint contract.
- Catalog ownership remains local and the iiko boundary is limited to
  operational availability.
- Missing mappings, stale state and provider failures have an explicit fail-safe
  outcome.
- The simulator can support deterministic contract/failure tests without
  pretending to be a production account.

Costs and limitations:

- A real iiko account and sanitized captures are still required to verify
  account-specific behavior, identifiers, limits and operational setup.
- The future adapter must implement context validation, runtime validation,
  freshness tracking and bounded external calls.
- Exact cadence, retry and persistence choices remain to be made in the M3
  implementation task within these boundaries.

## Owner Decision

```text
OWNER DECISION RECORDED

APPROVE ADR-002 — 2026-08-24

Summary:
- use POST /api/v2/access_token with apiKey, appId and clientSecret;
- use POST /api/1/organizations, POST /api/1/terminal_groups,
  POST /api/1/terminal_groups/is_alive and POST /api/1/stop_lists;
- keep Product/catalog ownership in our Backend and persist a required mapping
  to iiko productId (+ optional sizeId);
- treat missing/invalid mappings, stale/unknown state and every external failure
  as not orderable; require bounded timeout and runtime validation;
- keep M3 implementation within the accepted contract and its later task-level
  adapter decisions.
```
