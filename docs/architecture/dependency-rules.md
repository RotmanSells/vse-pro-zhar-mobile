# Dependency rules

## Разрешённые зависимости

Default policy: DENY. Межслойная зависимость разрешена только если она явно перечислена в разделе Allowed dependencies.

```text
Presentation → Application
Presentation → Shared contracts
Application → Domain
Application → Shared contracts
Infrastructure → Application
Infrastructure → Domain
Infrastructure → Shared contracts
Domain → Shared contracts
Framework presentation entrypoint → Composition root
Composition root → все необходимые реализации
```

`packages/contracts/src/**` is the existing `shared-contracts` layer. It contains
runtime-validated contracts shared by executable surfaces and does not import application
layers. The shared-contracts edges above preserve that existing boundary without making
contracts an application or domain implementation.

## Forbidden dependencies

```text
Application → Infrastructure
Presentation → Infrastructure
Domain → Application
Domain → Infrastructure
Domain → Presentation
Domain → React / React Native / Next.js
Domain → database / ORM
Presentation → database
Presentation → repository implementation
Domain/Application → concrete external provider SDK
```

Отсутствие зависимости в Allowed dependencies не означает разрешение. Новая межслойная зависимость требует обновления этого документа и, если решение архитектурное, ADR.

Для npm dependencies действует тот же deny-by-default подход: Domain и Application
могут использовать только явно разрешённые package names из
`policy/architecture-dependencies.json`. Infrastructure не ограничивается этим allowlist, потому
что именно она содержит adapters для concrete provider SDK.

## Framework presentation paths

Архитектурный checker сопоставляет route directories без явного layer segment с
Presentation только если путь принадлежит future framework surface:

```text
apps/*/app/**
apps/*/src/app/**
apps/*/pages/**
apps/*/src/pages/**
```

Это закрывает Expo Router mobile route и Next.js Admin route, не создавая
фейковые Domain/Application layers ради симметрии каталогов.

## Production-source classification

The architecture checker applies layer enforcement to JavaScript/TypeScript application
and module source under `apps/*`, `packages/*` and the root `src/`. Tests, fixtures,
generated/build output, declaration files, configuration, migration files and the
approved migration tooling entrypoint are outside that production-source boundary.

Every remaining production source file must be classified as an explicit layer, a
framework Presentation route, an approved Composition/bootstrap entrypoint or the
existing shared-contracts layer. An unclassified production source file is an
architecture violation; it is never silently skipped.

The approved path patterns are machine-readable in
`policy/architecture-entrypoints.json`. Current composition/bootstrap patterns are
`apps/*/src/main.ts` and `apps/mobile/src/mobile-health-root.tsx`; adding another
non-layered entrypoint requires an explicit policy entry. `apps/*/src/migrate.ts` is
tooling and is intentionally outside production-source enforcement.

## Cross-module boundaries

Модуль не импортирует internal-файлы другого модуля.

Запрещено:

```text
orders/application/* → cart/infrastructure/*
orders/domain/* → users/domain/internal/*
```

Разрешённое межмодульное взаимодействие проходит через:

- public application interface;
- explicit port;
- shared contract;
- domain/application event;
- специально определённый public module API.

Прямой импорт cart/src/internal/something.ts из orders запрещён. Модуль публикует явный public API.

## Ports and adapters

Interfaces/ports определяются в Domain или Application. Реализации находятся в Infrastructure.

Примеры:

```text
Domain/Application: PaymentGateway
Infrastructure: YooKassaPaymentGateway

Domain/Application: SmsSender
Infrastructure: SmsProviderAdapter

Application: OrderRepository
Infrastructure: PostgresOrderRepository
```

Каждый adapter валидирует внешние данные до передачи их в Application или Domain.

## Проверка

Архитектура будет проверяться автоматически через test:architecture и policy/rules-map.yaml.
