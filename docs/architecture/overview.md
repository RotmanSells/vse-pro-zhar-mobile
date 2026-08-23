# Архитектурный обзор

## Назначение

Проект «Все Про Жар Mobile» — отдельное мобильное приложение для iOS и Android с переиспользованием backend-контрактов прототипа и постепенным развитием production API.

Текущий репозиторий содержит M1 health shell и VPZH-017 persisted customer/profile
foundation: Node.js API, Expo Router mobile shell and Next.js Admin shell. Profile data
is persisted through a PostgreSQL repository; production authentication and the remaining
product data slices are still absent.

## Целевые приложения

```text
apps/mobile  — React Native + Expo клиент iOS/Android
apps/api     — Node.js + TypeScript API
apps/admin   — административный web-клиент
```

## Workspace tooling

Root `lint`, `typecheck`, `test:unit` and `build` discover every package listed
by `pnpm-workspace.yaml` under `apps/*` and `packages/*`. Each workspace package
must expose the matching command as its own package script; root orchestration
does not silently skip a package with a missing script.

VPZH-011 adds the real `apps/api` and `packages/contracts` packages.
`apps/api` owns the operational `GET /health` HTTP boundary through its
composition root; `packages/contracts` owns the shared runtime Zod contract for
health and safe public errors. No mock-only path defines the observable behavior.

Framework route directories `apps/**/app/**` and `apps/**/pages/**` are treated
as Presentation by the architecture checker. A shared strict TypeScript root
configuration remains the base that future Expo and Next.js package TypeScript
configurations extend.

VPZH-014 composes the mobile health capability outside the Expo route: its HTTP adapter
is Infrastructure, the narrow health-check port is Application, and the route only renders
presentation state. API JSON is accepted only after the shared Zod health contract validates it.
The public API URL is injected through Expo config at build/bundle time; Android Emulator CI
uses `10.0.2.2` only as its host-machine alias, never as a production endpoint.

VPZH-017 adds the first backend vertical slice. `X-VPZH-Development-Identity` is resolved
only by the explicitly enabled development/test boundary, then passed through the
Application identity port to the customer profile use cases and PostgreSQL repository.
The boundary fails closed for production runtime and creates no tokens, sessions or order
authorization.

VPZH-018 connects the guarded mobile development identity to that existing slice without
changing its API or database contracts. Mobile Presentation invokes an Application use
case through a current-profile port; the Infrastructure adapter owns `fetch`, the bounded
timeout, development header and shared `CustomerProfileResponseSchema` trust-boundary
validation. The mobile composition root supplies the adapter, and backend failures remain
explicit Application/UI error state rather than a local authentication fallback.

VPZH-020 adds profile editing without changing the API or database contracts. Mobile
Presentation keeps editable name/birthday draft state, invokes an Application save use case,
and receives the existing PATCH adapter through composition. Infrastructure validates the
shared patch request and response schemas. Only a successful backend-returned profile replaces
the confirmed profile; save failures retain the last confirmed values and remain visible.

## Направление зависимостей

```text
Presentation → Application → Domain
Infrastructure → Application / Domain
```

- Presentation содержит экраны, UI, HTTP controllers и adapters presentation-слоя.
- Application содержит use cases, orchestration и application services.
- Domain содержит entities, value objects, business rules, domain services и ports.
- Infrastructure содержит PostgreSQL, repositories, внешние API, SMS, push, maps, payments и queues.

Domain не знает о React, React Native, Next.js, HTTP, PostgreSQL, ORM или конкретном provider.

## Вертикальный срез

Каждая пользовательская функция проходит через необходимые слои:

```text
Mobile/Admin UI
→ API
→ Application use case
→ Domain rules
→ Infrastructure/DB
→ Admin capabilities, если нужны
→ Unit/Integration/E2E tests
```

## Границы текущего прототипа

Текущий прототип в отдельной папке является reference для:

- пользовательских сценариев;
- текущего REST API;
- PostgreSQL-модели;
- бизнес-правил заказов;
- меню, промокодов, клиентов и лояльности.

HTML-клиент прототипа не переносится в mobile-клиент напрямую.

## Архитектурные ограничения

- UI не содержит бизнес-правила.
- Domain не импортирует Infrastructure.
- Presentation не импортирует DB напрямую.
- Внешние данные валидируются на trust boundary.
- Публичные API изменения проходят compatibility policy.
- Срез не считается готовым на mock-only реализации.
