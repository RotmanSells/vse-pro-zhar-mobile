# AUTOMATION.md

# Автоматическая система контроля проекта «Все Про Жар Mobile»

Этот документ описывает только реально существующие и запланированные проверки. Он является связкой между RULES.md, scripts, CI, package.json и policy/rules-map.yaml.

## 1. Общий контракт проверок

Каждая реализованная проверка:

- запускается отдельной pnpm-командой;
- возвращает exit code 0 при успехе;
- возвращает exit code 1 при нарушении правила;
- возвращает exit code 2 при ошибке конфигурации, инфраструктуры или самого checker;
- выводит понятное описание проблемы;
- по возможности указывает файл и строку;
- детерминирована;
- одинаково работает локально и в CI.

Запрещены проверки, которые сообщают об ошибке, но возвращают exit 0. Нереализованные проверки не считаются gate.

## 2. Verification status

### Implemented

Documentation / policy foundation:

- RULES.md;
- AUTOMATION.md.
- AGENTS.md;
- policy/rules-map.yaml.

Executable gates:

- `pnpm format`;
- `pnpm format:check`;
- `pnpm lint`;
- `pnpm typecheck`;
- `pnpm check:test-hygiene`;
- `pnpm test:unit`;
- `pnpm test:integration`;
- `pnpm test:architecture`;
- `pnpm build`;
- `pnpm check:automation-sync`;
- `pnpm check:checker-exit-codes`;
- `pnpm check:task-contract`;
- `pnpm check:task-scope`;
- `pnpm check:diff-size`;
- `pnpm check:secrets`;
- `pnpm check:dependencies`;
- `pnpm verify:pr`;
- `pnpm verify:fast`;
- `pnpm verify`.

<!-- automation-sync:implemented-commands:start -->

- `pnpm format`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm check:test-hygiene`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:architecture`
- `pnpm build`
- `pnpm check:automation-sync`
- `pnpm check:checker-exit-codes`
- `pnpm check:task-contract`
- `pnpm check:task-scope`
- `pnpm check:diff-size`
- `pnpm check:secrets`
- `pnpm check:dependencies`
- `pnpm verify:fast`
- `pnpm verify`
- `pnpm verify:pr`

<!-- automation-sync:implemented-commands:end -->

The delimited list above is synchronized with `policy/automation-registry.json` by
`pnpm check:automation-sync`; prose in this document is not parsed as an API.

Workspace execution contract:

- `scripts/lib/workspace.mjs` reads `pnpm-workspace.yaml`, discovers every
  one-level `apps/*` and `packages/*` package, and rejects a matched directory
  without `package.json`.
- Root `lint`, `typecheck`, `test:unit` and `build` first run their existing root
  implementation, then run the matching package command through
  `scripts/checks/workspace-run.mjs` in deterministic path order.
- A discovered package must declare the orchestrated script. Missing scripts fail
  with exit 1 and `WORKSPACE_VIOLATION`; there is no `--if-present` silent skip.
- A command subprocess returns its native exit code unchanged; numeric exit 2 from
  ESLint, TypeScript, Jest or a build does not become `WORKSPACE_ERROR`.
  `WORKSPACE_ERROR` is reserved for the wrapper's own discovery or spawn failures.

CI gates:

- `.github/workflows/verify.yml` installs the pinned toolchain with a frozen lockfile;
  pull requests run `pnpm verify:pr`, while pushes to `main` run `pnpm verify`.

Наличие документа или policy-файла не означает, что checker уже реализован.

### Planned

Запланированы команды:

```text
pnpm test:e2e
pnpm test:security
pnpm test:migrations
pnpm test:contracts
pnpm test:performance
pnpm test:smoke

pnpm check:docs
pnpm check:adr
pnpm check:api-compat
pnpm check:sql-safety
pnpm check:regression-test
pnpm verify:milestone
pnpm verify:release
```

## 3. Когда создавать проверки

### Этап 0 — сейчас: инженерный фундамент

Созданы:

```text
format:check
lint
typecheck
check:test-hygiene
test:unit
test:architecture
build
check:automation-sync
check:checker-exit-codes
check:task-contract
check:task-scope
check:diff-size
verify:fast
verify
```

Также созданы strict TypeScript, ESLint, Prettier, Jest, import graph checker,
package manager, lockfile и базовый CI.

### Следующий engineering этап — PR policy gates

Реализовать до активной продуктовой разработки отдельной engineering-задачей:

```text
check:secrets
check:dependencies
```

`check:task-contract` валидирует текущий `docs/tasks/VPZH-XXX.yaml` against
`contracts/tasks/task.schema.json` and fails for a missing, invalid or incomplete
Definition of Ready manifest.

Active task identity MUST be explicit:

1. CI or the local command receives `TASK_ID=VPZH-XXX`;
2. the checker resolves `docs/tasks/${TASK_ID}.yaml`;
3. branch naming may be validated against `TASK_ID`, but is not the sole source
   of truth.

The checker MUST NOT guess an active task by selecting an arbitrary planned or
in-progress manifest.

`check:task-scope` compares the Git diff with `scope.paths`, including glob
semantics, and reports `TASK_SCOPE_VIOLATION` for an out-of-scope file.

`check:diff-size` separates generated files, lockfiles and snapshots from the
meaningful diff. Project guidance is: up to ~1200 lines is normal, 1200–2500
requires review, 2500–3000 is a strong warning, and >3000 meaningful lines is a
hard failure without an approved exception.

`check:secrets` scans both the repository and PR diff for API/private keys,
tokens, credentials, `.env` secrets and provider secrets; fixtures may contain
only fake/example values and must include negative cases.

`check:dependencies` checks lockfile consistency, pinned package-manager use,
dependency hygiene and security audit findings. It must not update dependencies
automatically merely to make CI green.

`verify:pr` runs:

```text
verify
→ check:task-contract
→ check:task-scope
→ check:diff-size
→ check:secrets
→ check:dependencies
```

The PR workflow must run `pnpm verify:pr`. `check:secrets` and
`check:dependencies` deliberately belong here rather than waiting for API/DB:
`package.json`, the lockfile and source-control history already exist.

For pull requests, task identity is declared explicitly by the PR title. It
must begin with `VPZH-XXX`; CI resolves that prefix to `TASK_ID`. Branch names,
manifest status, changed-file lists and manifest discovery are not identity
sources. `DIFF_BASE` is the pull request base SHA from
`github.event.pull_request.base.sha`. The pull-request workflow runs
`pnpm verify:pr`; pushes to `main` continue to run ordinary `pnpm verify`.

### Первый vertical slice

Создать:

```text
docs/tasks/TASK-XXX.yaml
check:docs
check:adr
check:regression-test
test:e2e
```

Каждый milestone имеет минимум один E2E главного пользовательского сценария.

### API и PostgreSQL

Создать:

```text
test:integration
test:migrations
check:sql-safety
```

Integration tests use an isolated test DB. Migration tests cover a clean DB,
upgrade from the previous supported schema, legacy data migration and destructive
migration policy. `check:sql-safety` rejects obvious unsafe SQL interpolation;
the standard `pg` path is parameterized queries.

### Публичный API contract

Создать:

```text
check:api-compat
test:contracts
test:security
test:smoke
```

`test:security` covers authentication, authorization, permissions, input
validation, token/session behavior and sensitive-data exposure when applicable.

### Milestone и release gates

Создать:

```text
test:performance
verify:release
```

Проверять production build, critical flows, performance budgets и release smoke.

`verify:milestone` is planned as:

```text
verify:pr
→ contracts
→ integration
→ E2E
→ security
→ migrations
```

`verify:release` adds a production build, measurable performance budgets, smoke
tests and release-specific checks to `verify:milestone`.

### GitHub guardrails

VPZH-009 configures and enforces the following GitHub repository policy for
`main`:

- pull requests are required; direct pushes are not allowed;
- the successful PR `Verify` workflow check (`verify` job, running
  `pnpm verify:pr`) is mandatory;
- branches must be up to date with `main` before merging, so stale head checks
  are invalidated;
- administrator/owner enforcement is enabled without a bypass actor;
- force pushes and deletion of `main` are disabled;
- squash merge is the only enabled repository merge method; merge commits and
  rebase merges are disabled;
- a failing mandatory gate prevents merge.

This is repository enforcement, not text-only policy. The policy applies to the
existing `verify:pr` gate; no additional checker or command is introduced here.

## 4. Mapping RULE-ID → command → failure

Полный машинный mapping хранится в policy/rules-map.yaml. Ниже фиксируется назначение основных команд.

### pnpm lint

Enforces:

- TS-001;
- TS-002;
- TS-004;
- TS-005;
- REACT-001;
- ARCH-002, если реализовано import-rule в lint.

Checks:

- explicit any;
- @ts-ignore;
- floating promises;
- unsafe async callbacks;
- React hooks dependencies;
- invalid imports и unsafe patterns.

Runs:

- локально через verify:fast и verify;
- в каждом PR CI.

Failure: ESLint uses its native non-zero CLI contract. Custom project checkers use
the 0/1/2 contract from section 1; the third-party CLI is not falsely reclassified.

The root lint command runs ESLint for the root project and then runs every
workspace package's `lint` script through the workspace runner.

### pnpm typecheck

Enforces:

- TS-003;
- TS-006;
- TS-007.

Checks:

- strict TypeScript;
- unsafe casts;
- type errors.

Runs:

- локально через verify:fast и verify;
- в каждом PR CI.

Failure: TypeScript uses its native non-zero CLI contract. Custom project checkers
use the 0/1/2 contract from section 1.

The root typecheck command typechecks the root project and then runs every
workspace package's `typecheck` script through the workspace runner.

### pnpm test:architecture

Enforces:

- ARCH-001;
- ARCH-002;
- ARCH-003;
- ARCH-004;
- ARCH-005;
- ARCH-006;
- ARCH-007;
- DATA-002.

Checks:

- import graph;
- DENY-by-default cross-layer edges;
- Domain → outer layers and framework/database packages;
- Presentation → Infrastructure and database packages;
- Domain/Application → any npm dependency outside the explicit per-layer allowlists in `policy/architecture-dependencies.json`;
- direct imports of another module's `internal` file in the `modules/<module>/...` layout;
- circular dependencies.

Runs:

- начиная с этапа 0;
- локально через verify;
- в каждом PR CI.

Failure:

- exit 1 при нарушении архитектурного правила;
- exit 2 при ошибке checker или его policy.

### pnpm test:unit

Enforces:

- TEST-001;
- TEST-002;
- TEST-011;
- BUG-001 для unit regression tests.

Runs:

- начиная с этапа 0;
- локально через verify:fast и verify;
- в каждом PR CI.

Failure: Jest uses its native non-zero CLI contract. Custom project checkers use
the 0/1/2 contract from section 1.

The root unit-test command runs the root Jest suite and then runs every workspace
package's `test:unit` script through the workspace runner.

### pnpm test:integration

Enforces:

- TEST-003;
- TEST-005;
- ERR-002;
- DATA-001.

Runs:

- начиная с штатного API health shell;
- в verify; PR CI исполняет его через verify:pr.

Failure:

- exit 1 при failing integration test;
- exit 2 при ошибке запуска HTTP-окружения.

### pnpm test:e2e

Enforces:

- SLICE-005;
- TEST-006;
- DOD-001;
- DOD-003.

Runs:

- начиная с первого вертикального среза;
- в verify:milestone;
- в milestone CI.

Failure:

- exit 1 при failing user flow;
- exit 2 при ошибке test environment.

### pnpm test:migrations

Enforces:

- DB-001;
- DB-003;
- DB-004;
- DB-005;
- DB-006.

Runs:

- после появления БД;
- в PR при database_change;
- в verify:milestone.

Failure:

- exit 1 при нарушении migration policy или schema validation;
- exit 2 при ошибке запуска БД/checker.

### pnpm check:regression-test

Enforces:

- BUG-001;
- BUG-003;
- BUG-004;
- BUG-005.

Checks:

- bugfix manifest;
- изменение test file;
- наличие regression test;
- связь с TASK-ID.

Runs:

- начиная с первого bugfix;
- в verify:pr для type: bugfix.

Failure:

- exit 1, если regression test отсутствует;
- exit 2 при неверном task manifest.

### pnpm check:task-contract

Enforces:

- TASK-001;
- TASK-002;
- TASK-003;
- TASK-004;
- TASK-005;
- TASK-006.

Checks the active `docs/tasks/VPZH-XXX.yaml` against
`contracts/tasks/task.schema.json` and the required Definition of Ready fields.

The command receives `TASK_ID=VPZH-XXX` and resolves only
`docs/tasks/${TASK_ID}.yaml`; it must not infer task identity from manifest
statuses. A branch name may be checked against `TASK_ID`, but cannot replace it.

Runs in `verify:pr` before active product development.

Failure: exit 1 for a missing, invalid or incomplete task manifest; exit 2 for
checker or schema configuration errors.

### pnpm check:task-scope

Enforces:

- TASK-003;
- TASK-004;
- SCOPE-001;
- SCOPE-006;
- AGENT-002.

Checks:

- committed `DIFF_BASE...HEAD` merge-base diff;
- exact and anchored glob matching for every changed repository path;
- both old and new paths for rename/copy, including deletions;
- explicit `TASK_ID` selected by CI or the local command.

Runs:

- начиная с первого task manifest;
- в verify:pr.

Failure:

- exit 1 with `TASK_SCOPE_VIOLATION` при scope violation;
- exit 2 при отсутствии/ошибке manifest, base ref или Git diff.

### pnpm check:api-compat

Enforces:

- API-001;
- API-002;
- API-003;
- API-004;
- API-005.

Checks:

- OpenAPI diff;
- удаление endpoint/field;
- несовместимое required field;
- изменение types/status contract/request schema.

Runs:

- после появления machine-readable API contract;
- в verify:pr при api_change;
- перед release.

Failure:

- exit 1 при breaking change без разрешения;
- exit 2 при невозможности сгенерировать или сравнить contract.

### pnpm check:secrets

Enforces:

- SEC-001;
- SEC-002;
- SEC-003;
- SEC-005.

Checks:

- Git diff;
- private keys;
- tokens;
- API credentials;
- запрещённые .env, .pem и .key files.

Runs:

- in `verify:pr` before active product development;
- in every PR CI;
- before release.

Failure:

- exit 1 при найденном secret;
- exit 2 при ошибке scanner.

### pnpm check:sql-safety

Enforces:

- TS-008;
- DB-008;
- ARCH-007.

Checks:

- SQL interpolation/concatenation;
- raw SQL вне infrastructure/repository;
- неконтролируемые N+1 patterns, если checker способен их определить.

Runs:

- после появления DB;
- в verify:pr при database_change или backend change.

Failure:

- exit 1 при небезопасном SQL;
- exit 2 при ошибке AST/lint checker.

### pnpm format:check

Enforces:

- AUTO-007.

Checks форматирование без изменения файлов. Runs начиная с этапа 0 через verify:fast, verify и PR CI.

Failure: Prettier uses its native non-zero CLI contract and never modifies files in check mode.

### pnpm check:test-hygiene

Enforces:

- TEST-008;
- TEST-009;
- TEST-010.

Checks `tests/**`, `apps/**`, `packages/**` and `src/**` for focused tests and skips
without a documented reason/task reference. It explicitly ignores `.git`,
`node_modules`, `dist`, `coverage`, `.expo`, `.next`, `build`, `generated` and
`.generated` directories. Runs с этапа 0 through verify and PR CI.

Failure: exit 1 при нарушении; exit 2 при ошибке checker.

The checker parses test files with Babel AST rather than matching source text. A
skip is permitted only when its test title includes both a meaningful reason and
a `VPZH-<number>` task reference. It does not attempt to prove whether that
reason remains current; that is reviewer evidence.

### pnpm check:dependencies

Enforces:

- SEC-007.

Checks vulnerability audit, lockfile integrity, license policy and unexpected
dependencies. For every discovered workspace importer it compares that package's
direct dependency sections with the corresponding `pnpm-lock.yaml` importer,
requires an importer even for dependency-free packages, and rejects orphan
non-root workspace importers. Runs in `verify:pr` before active product
development and before release.

Failure: exit 1 при нарушении policy; exit 2 при ошибке scanner или отсутствии его конфигурации.

### pnpm test:security

Enforces:

- SEC-004;
- SEC-006;
- SEC-007;
- SEC-008.

Checks применимые auth, authorization, permissions, PII, sessions, tokens, public API, SAST и OWASP risks. Runs в verify:milestone и verify:release.

Failure: exit 1 при security finding; exit 2 при ошибке security environment.

### pnpm test:contracts

Enforces:

- API-001;
- API-002;
- REL-001;
- REL-002.

Checks adapter ↔ external provider в sandbox. Runs в milestone CI, по расписанию, перед release или при изменении adapter.

Failure: exit 1 при несовместимости или failing contract; exit 2 при ошибке sandbox.

### pnpm test:performance

Enforces:

- PERF-001;
- PERF-002;
- PERF-003;
- PERF-004;
- PERF-005.

Checks только заранее определённые critical flows и performance budgets после benchmark baseline. Runs перед production release.

Failure: exit 1 при нарушении budget; exit 2 при ошибке benchmark environment.

### pnpm test:smoke

Enforces:

- ERR-006;
- SEC-008;
- DOD-001.

Checks health, DB connectivity, critical endpoint, bundle start и базовый auth flow после build/deployment. Runs в release environment.

Failure: exit 1 при failing smoke; exit 2 при ошибке окружения.

### pnpm check:automation-sync

Enforces:

- AUTO-001;
- AUTO-004;
- AUTO-005.

Checks the machine-readable implemented-command registry against AUTOMATION.md,
package.json, CI configuration and policy/rules-map.yaml, including exact equality
between every registered command implementation and its `package.json` script.
Runs starting at stage 0 through verify and CI.

Failure: exit 1 при расхождении; exit 2 при ошибке чтения configuration.

### pnpm check:checker-exit-codes

Enforces:

- AUTO-006;
- AUTO-007.

Runs negative fixtures to prove that custom checkers return 1 for a rule violation
and 2 for a checker/configuration/infrastructure error. Runs starting at stage 0
through verify and CI.

Failure: exit 1 при неправильном exit code checker; exit 2 при ошибке запуска harness.

### pnpm build

Compiles the existing TypeScript foundation code with `tsconfig.build.json` and
then runs every workspace package's `build` script through the workspace runner.
It is not a placeholder mobile or API build; product applications do not exist at
this stage. The TypeScript CLI uses its native non-zero exit contract.

### pnpm verify:fast

Runs `format:check → lint → typecheck → test:unit` for frequent local feedback.

### pnpm verify

Runs `format:check → lint → typecheck → check:test-hygiene → test:unit →
test:architecture → check:automation-sync → check:checker-exit-codes → build`.
Commands are chained without ignored failures, so it stops at the first mandatory
gate that fails. CI runs this exact entrypoint.

### pnpm check:diff-size

Enforces:

- SCOPE-001;
- SCOPE-002;
- SCOPE-003;
- SCOPE-004;
- SCOPE-005;
- SCOPE-006.

Config:

```json
{
  "recommended": 1200,
  "warning": 2500,
  "hardLimit": 3000
}
```

Migrations проверяются отдельной destructive/size policy.

The command receives `TASK_ID=VPZH-XXX` and `DIFF_BASE=<commit-or-ref>`. It uses
the committed merge-base diff to `HEAD`, counts additions plus deletions only for
meaningful files, and reports generated `dist/**`, `pnpm-lock.yaml`, Jest snapshots
and binary files separately. Missing or invalid inputs fail with exit 2. Meaningful
lines from 0 to 1200 are normal, 1201–2500 produce a review warning, 2501–3000
produce a strong warning, and more than 3000 returns `DIFF_SIZE_VIOLATION` with
exit 1.

Runs:

- с первого task manifest;
- в verify:pr.

Failure:

- exit 1 при превышении hard limit;
- exit 2 при ошибке определения base diff.

### pnpm check:docs

Enforces:

- DOC-001;
- DOC-002;
- AUTO-004;
- AUTO-005.

Runs:

- в verify:pr после появления module mapping и task manifest.

Failure:

- exit 1 при отсутствии обязательной документации;
- exit 2 при ошибке mapping/checker.

### pnpm check:adr

Enforces:

- ADR-001;
- ADR-002;
- AGENT-003;
- AUTO-003.

Runs:

- в verify:pr при architecture_change или изменении protected paths.

Failure:

- exit 1 при отсутствии требуемого ADR;
- exit 2 при ошибке policy/checker.

## 5. Verification commands

### pnpm verify:fast

```text
format:check
→ lint
→ typecheck
→ test:unit
```

Создаётся на этапе 0.

### pnpm verify

```text
format:check
→ lint
→ typecheck
→ check:test-hygiene
→ test:unit
→ test:integration
→ test:architecture
→ build
```

До появления integration tests команда не включает несуществующую проверку.

### pnpm verify:pr

```text
verify
→ check:task-contract
→ check:task-scope
→ check:diff-size
→ check:secrets
→ check:dependencies
```

Later conditional gates are added to this command only when their subject exists:
docs/ADR/regression/E2E after the first vertical slice, SQL/integration/migrations
after API and PostgreSQL, and API compatibility/contracts/security/smoke after a
public API contract.

### pnpm verify:milestone

```text
verify:pr
→ test:contracts
→ test:e2e
→ test:security
→ полный migration suite
```

### pnpm verify:release

```text
verify:milestone
→ production build
→ test:performance
→ test:smoke
```

## 6. Synchronization rule

**[AUTO-001] 🔴 MUST** — AUTOMATION.md соответствует реально существующим scripts и CI.

AUTOMATION.md MUST соответствовать:

```text
package.json
CI configuration
scripts/checks/*
policy/rules-map.yaml
```

Добавление, изменение или удаление обязательного gate обновляет AUTOMATION.md в том же PR и task commit.

Также одновременно обновляются:

- policy/rules-map.yaml;
- package.json, если меняется команда;
- CI configuration, если меняется pipeline;
- соответствующий checker или script.

## 7. Что не проверяется только скриптом

Автоматизация не доказывает полностью:

- правильность бизнес-требования;
- наличие настоящего root cause;
- качество UX;
- разумность архитектурной абстракции;
- правильность scope;
- качество ADR.

Для этого нужны AI/human review и решение владельца, когда требуется.

## 8. Идеальный workflow

```text
TASK
→ machine-readable DoR
→ AI читает RULES + AUTOMATION + AGENTS + architecture + ADR + module README + tests
→ failing test
→ implementation
→ pnpm verify
→ diff review
→ pnpm verify:pr
→ PR
→ CI
→ merge
```
