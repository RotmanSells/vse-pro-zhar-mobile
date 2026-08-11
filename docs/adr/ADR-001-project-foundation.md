# ADR-001: Project foundation and modular vertical-slice architecture

- Status: Accepted
- Date: 2026-08-11
- Scope: mobile, API, admin, tooling and policy

## Context

The existing «Все Про Жар» project is a working prototype. The new project uses one React Native codebase targeting both iOS and Android, while preserving the prototype as a source of product scenarios, business rules and API expectations.

The project must support LEGO-style modularity, TDD, vertical slices, AI-agent work and automated CI enforcement.

## Decision

The project uses:

- React Native + Expo + TypeScript for mobile;
- Node.js + TypeScript for the API;
- PostgreSQL for persistent data;
- a separate Next.js administrative web client;
- Zod for runtime validation at trust boundaries;
- pg with parameterized SQL for PostgreSQL access; no ORM is selected;
- Presentation → Application → Domain dependency direction;
- Infrastructure adapters implementing ports from Application or Domain;
- machine-readable task manifests;
- RULES.md, AUTOMATION.md, AGENTS.md and policy/rules-map.yaml as engineering control documents;
- vertical slices as the unit of product delivery;
- pnpm, ESLint, Prettier, unit/integration/E2E tests and GitHub Actions as the foundation tooling.

The current HTML prototype is not copied into the mobile client. Its scenarios, data and API behaviour are used as reference.

## Alternatives considered

### Separate native Swift and Kotlin applications

Rejected for the first implementation because it doubles feature implementation and testing cost.

### Flutter

Viable alternative, but React Native + Expo aligns better with the existing JavaScript/Node ecosystem and the planned TypeScript API.

### Horizontal implementation by technical layer

Rejected because it delays integration feedback and allows incomplete layers to appear finished.

## Consequences

Positive:

- shared TypeScript ecosystem;
- one mobile codebase for iOS and Android;
- explicit dependency boundaries;
- automation can map RULE-ID to concrete checks;
- each milestone produces a demonstrable feature.

Negative:

- architecture and contracts require discipline;
- CI and task manifests add initial setup work;
- native platform exceptions may require Expo development builds and native modules.

## Constraints

This ADR does not permit overriding a RULES.md MUST. A change to this decision requires a new or updated accepted ADR and explicit owner review.
