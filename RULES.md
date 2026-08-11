# RULES.md

# Инженерные правила проекта «Все Про Жар Mobile»

Документ обязателен для разработчиков, AI coding agents, reviewers, CI/CD, генераторов кода, миграций, backend, mobile, admin и infrastructure-кода.

Главный принцип: всё, что можно надёжно проверить автоматически, должно проверяться автоматически.

## Enforcement

Каждое правило относится к одному классу:

- **hard** — нарушение объективно определяется автоматической проверкой;
- **evidence** — проверка требует доказательство выполнения, но не оценивает весь смысл;
- **review** — требуется решение владельца или reviewer.

AI-agent не является окончательным арбитром соблюдения правил. Для hard/evidence правил источником факта выполнения является CI.

Уровни строгости:

- **🔴 MUST** — обязательно; нарушение блокирует завершение задачи;
- **🟡 SHOULD** — соблюдается по умолчанию; исключение требует обоснования;
- **🟢 MAY** — применяется по необходимости.

## Source of truth

При конфликте применяется приоритет:

1. Явное решение или waiver владельца проекта.
2. RULES.md.
3. Accepted ADR — только для архитектурных решений в рамках RULES.md.
4. Специализированный machine-readable contract для своей области.
5. Task manifest.
6. Module documentation.
7. Implementation.

ADR не может отменить RULES.md. Task не может отменить RULES.md или accepted ADR. Изменение MUST требует явного решения владельца.

При противоречии агент делает STOP, сообщает владельцу источник конфликта и не придумывает компромисс самостоятельно.

Специализированный источник истины имеет приоритет для своей области:

- OpenAPI/API contract — API shape и schema;
- schema БД и migrations — схема БД;
- policy/rules-map.yaml — machine-readable mapping правил;
- accepted ADR — принятое архитектурное решение.

RULES.md не заменяет конкретный API contract или schema БД.

## 1. Основные принципы

- **[CORE-001] 🔴 MUST** — выбирать самое простое корректное решение без создания инфраструктуры «на будущее».
- **[CORE-002] 🔴 MUST** — god-service, god-component и god-module запрещены.
- **[CORE-003] 🟡 SHOULD** — один файл обычно содержит одну сущность, use case, адаптер, контракт или группу тесно связанных функций.
- **[CORE-004] 🟡 SHOULD** — имя файла отражает ответственность; искусственные микро-файлы запрещены.
- **[CORE-005] 🟡 SHOULD** — предпочитать явный код чрезмерным абстракциям.

## 2. Архитектурные границы

Разрешённое направление:

~~~text
Presentation → Application → Domain
Infrastructure → Application / Domain
~~~

Infrastructure реализует порты Application или Domain.

- **[ARCH-001] 🔴 MUST** — Domain не импортирует Infrastructure.
- **[ARCH-002] 🔴 MUST** — Presentation не импортирует DB или repository implementation напрямую.
- **[ARCH-003] 🔴 MUST** — Domain не зависит от React, React Native, Next.js, HTTP, PostgreSQL, ORM, payment/SMS/push provider или конкретной очереди.
- **[ARCH-004] 🔴 MUST** — бизнес-правила не находятся в UI.
- **[ARCH-005] 🔴 MUST** — инфраструктурные реализации подключаются через interfaces/ports.
- **[ARCH-006] 🔴 MUST** — архитектурные границы и неразрешённые циклические зависимости проверяются автоматически.
- **[ARCH-007] 🟡 SHOULD** — прямой доступ к HTTP-клиенту, DB client и queue SDK находится только в infrastructure/adapters.

## 3. Definition of Ready

До разработки задачи определить:

- **[TASK-001] 🔴 MUST** — пользовательский или административный сценарий;
- **[TASK-002] 🔴 MUST** — критерии готовности;
- **[TASK-003] 🔴 MUST** — границы: что входит и не входит;
- **[TASK-004] 🔴 MUST** — затронутые модули и слои;
- **[TASK-005] 🔴 MUST** — тестовый план;
- **[TASK-006] 🔴 MUST** — способ проверки на тестовой среде;
- **[TASK-007] 🟡 SHOULD** — API contract, security impact, migration impact, performance impact и необходимость ADR.

Если границы нельзя определить без архитектурного решения, сначала принять решение и оформить ADR.

## 4. Вертикальные срезы

- **[SLICE-001] 🔴 MUST** — каждый milestone проходит через все затронутые слои:

~~~text
UI → API → Application → Domain → БД → Admin → Tests
~~~

- **[SLICE-002] 🔴 MUST** — запрещены горизонтальные этапы «сначала вся БД, потом весь backend, потом mobile».
- **[SLICE-003] 🟡 SHOULD** — каждый milestone заканчивается работающей пользовательской возможностью.
- **[SLICE-004] 🔴 MUST** — основная функциональность не может оставаться только mock-режимом.
- **[SLICE-005] 🔴 MUST** — каждый milestone имеет минимум один E2E главного сценария.
- Отдельный infrastructure/architecture milestone допускается только как явно утверждённое исключение.

## 5. Ошибки и надёжность

- **[ERR-001] 🔴 MUST** — пустые catch запрещены.
- **[ERR-002] 🔴 MUST** — ошибка обрабатывается, преобразуется, передаётся выше или логируется с причиной.
- **[ERR-003] 🔴 MUST** — публичный API error format документирован: HTTP status, stable code, safe message.
- **[ERR-004] 🔴 MUST** — stack trace, SQL, secrets и внутренние детали не возвращаются пользователю.
- **[ERR-005] 🔴 MUST** — пользовательские и внутренние ошибки разделены.
- **[ERR-006] 🟡 SHOULD** — критичные операции имеют correlation/request ID.
- **[REL-001] 🔴 MUST** — внешние сетевые вызовы имеют timeout.
- **[REL-002] 🟡 SHOULD** — retry применяется только для безопасных повторов и использует bounded retries, backoff и jitter.
- **[REL-003] 🔴 MUST** — неидемпотентную операцию нельзя автоматически повторять без защиты.
- **[REL-004] 🟢 MAY** — circuit breaker и dead-letter queue используются для критичных интеграций по необходимости.
- **[REL-005] 🔴 MUST** — система не предполагает exactly-once delivery для HTTP, webhook и queue.
- **[REL-006] 🔴 MUST** — повторяемые операции, способные нарушить инварианты, проектируются идемпотентными.
- **[REL-007] 🔴 MUST** — критичные изменения состояния учитывают concurrency.

## 6. TypeScript

- **[TS-001] 🔴 MUST** — explicit any запрещён.
- **[TS-002] 🔴 MUST** — @ts-ignore запрещён.
- **[TS-003] 🔴 MUST** — TypeScript работает в strict mode.
- **[TS-004] 🔴 MUST** — floating promises запрещены.
- **[TS-005] 🔴 MUST** — Promise должен быть awaited, returned, корректно объединён или явно оформлен как безопасный fire-and-forget с обработкой ошибки.
- **[TS-006] 🔴 MUST** — unsafe cast не заменяет runtime validation.
- **[TS-007] 🟡 SHOULD** — на недоверенных границах использовать unknown вместо any.
- **[TS-008] 🔴 MUST** — backend SQL использует параметры или безопасный query builder/ORM.

## 7. Runtime validation

- **[DATA-001] 🔴 MUST** — недоверенные внешние данные валидируются во время выполнения.
- **[DATA-002] 🔴 MUST** — invalid external data не попадает бесконтрольно в Domain.
- **[DATA-003] 🟡 SHOULD** — данные raw SQL, JSON/JSONB, legacy data и migration дополнительно валидируются.

Trust boundaries включают HTTP, webhooks, queues, push, deep links, environment variables, local storage, user input, file metadata и JSON imports.

## 8. React и React Native

- **[REACT-001] 🔴 MUST** — React hooks имеют корректные dependencies.
- **[REACT-002] 🔴 MUST** — UI не обращается напрямую к DB или infrastructure.
- **[REACT-003] 🔴 MUST** — бизнес-логика не реализуется в UI-компонентах.
- **[REACT-004] 🟡 SHOULD** — тяжёлая логика выносится из render path.
- **[REACT-005] 🟡 SHOULD** — большие списки используют виртуализацию.
- **[REACT-006] 🟡 SHOULD** — не использовать неограниченный Promise.all для больших наборов.

## 9. TDD и тестирование

- **[TEST-001] 🔴 MUST** — TDD применяется для бизнес-правил, расчётов, validation, permissions, authorization, payments, status transitions, idempotency, concurrency, промокодов, скидок и bug fixes.
- **[TEST-002] 🔴 MUST** — unit tests проверяют наблюдаемое поведение и критические инварианты.
- **[TEST-003] 🔴 MUST** — integration tests проверяют реальные связки API, application, repository, БД, migrations и authorization.
- **[TEST-004] 🔴 MUST** — integration tests используют изолированную test DB.
- **[TEST-005] 🔴 MUST** — тесты не зависят от порядка запуска или данных предыдущего теста.
- **[TEST-006] 🔴 MUST** — E2E работает с реальными внутренними слоями и изолированной БД.
- **[TEST-007] 🔴 MUST** — production operations никогда не выполняются из тестов.
- **[TEST-008] 🔴 MUST** — committed code не содержит случайных .only/focused tests.
- **[TEST-009] 🔴 MUST** — skipped test имеет documented reason и task reference.
- **[TEST-010] 🔴 MUST** — flaky test считается дефектом и не лечится sleep без root cause.
- **[TEST-011] 🟡 SHOULD** — coverage приоритетно покрывает business invariants.
- **[TEST-012] 🟡 SHOULD** — coverage threshold не уменьшается в обычной feature-задаче.

TDD не обязателен для статичной вёрстки, цветов, отступов, простого boilerplate и исследовательского prototype-кода.

## 10. Security

- **[SEC-001] 🔴 MUST** — secrets не попадают в Git.
- **[SEC-002] 🔴 MUST** — production secrets находятся в secret storage/deployment environment.
- **[SEC-003] 🔴 MUST** — .env.example не содержит настоящих значений.
- **[SEC-004] 🔴 MUST** — до security-sensitive функции определить auth, roles, permissions, sessions/tokens, rate limiting и validation.
- **[SEC-005] 🔴 MUST** — PII, passwords, tokens и secrets не логируются.
- **[SEC-006] 🔴 MUST** — security tests обязательны для auth, permissions, payments, files, HTML, webhooks, public APIs, PII, sessions, tokens и admin.
- **[SEC-007] 🟡 SHOULD** — выполнять dependency scanning и OWASP checks.
- **[SEC-008] 🔴 MUST** — production использует HTTPS/HSTS, если применимо.

## 11. Database и migrations

- **[DB-001] 🔴 MUST** — production schema изменяется только versioned migration.
- **[DB-002] 🔴 MUST** — migrations входят в Git history.
- **[DB-003] 🔴 MUST** — migration проходит на clean DB и предыдущей поддерживаемой schema.
- **[DB-004] 🔴 MUST** — destructive migration требует data migration plan.
- **[DB-005] 🔴 MUST** — применённую production migration нельзя изменять; создаётся новая.
- **[DB-006] 🔴 MUST** — нельзя предполагать мгновенное обновление всех backend instances.
- **[DB-007] 🟡 SHOULD** — использовать EXPAND → compatible code → migrate data → CONTRACT.
- **[DB-008] 🔴 MUST** — неконтролируемые N+1 queries запрещены.

## 12. API compatibility

- **[API-001] 🔴 MUST** — публичный API имеет machine-readable contract.
- **[API-002] 🔴 MUST** — breaking API change запрещён без migration, deprecation или versioning strategy.
- **[API-003] 🔴 MUST** — backend не ломает поддерживаемые mobile clients без compatibility strategy.
- **[API-004] 🔴 MUST** — удаление public API требует deprecation plan.
- **[API-005] 🟡 SHOULD** — изменения API по возможности additive.
- **[API-006] 🔴 MUST** — API errors имеют stable codes и safe messages.

OpenAPI или другой API contract является источником истины для API shape.

## 13. Даты и время

- **[TIME-001] 🔴 MUST** — absolute timestamps хранятся в UTC.
- **[TIME-002] 🔴 MUST** — timezone хранится отдельно, если локальное время влияет на бизнес-логику.
- **[TIME-003] 🔴 MUST** — backend logic не зависит от timezone процесса.
- **[TIME-004] 🔴 MUST** — релевантные date scenarios тестируются для границ суток, DST, timezone и expiration.

## 14. Производительность

- **[PERF-001] 🟡 SHOULD** — большие mobile lists используют FlashList, FlatList, VirtualizedList или эквивалент.
- **[PERF-002] 🟡 SHOULD** — изображения загружаются в подходящем размере и оптимизированном формате.
- **[PERF-003] 🟡 SHOULD** — critical screens проверяются на недорогом Android среднего класса.
- **[PERF-004] 🟡 SHOULD** — перед release измеряются cold start, catalog load, search, cart, checkout и API latency.
- **[PERF-005] 🔴 MUST** — оптимизация выполняется после измерения, если нет очевидной алгоритмической проблемы.

## 15. Размер, Git и scope

- **[SCOPE-001] 🔴 MUST** — одна задача соответствует одному логическому diff.
- **[SCOPE-002] 🟡 SHOULD** — нормальный размер задачи 300–1200 содержательных строк.
- **[SCOPE-003] 🟡 SHOULD** — 1500–2500 строк допустимы для цельного vertical slice.
- **[SCOPE-004] 🔴 MUST** — примерно 3000 содержательных строк — верхний предел без явного разрешения.
- **[SCOPE-005] 🔴 MUST** — generated files, lockfiles и snapshots не скрывают содержательные изменения от diff checker.
- **[GIT-001] 🔴 MUST** — одна задача = одна ветка = один PR = один итоговый логический commit.
- **[GIT-002] 🟡 SHOULD** — ветка имеет формат task/task-name.
- **[SCOPE-006] 🔴 MUST** — несвязанные изменения не включаются в PR.
- **[SCOPE-007] 🔴 MUST** — несвязанный баг выносится в отдельную задачу, кроме security или блокирующего бага с зафиксированной причиной.

## 16. Документация и ADR

- **[DOC-001] 🟡 SHOULD** — значимый модуль имеет README с назначением, файлами, dependencies, public interfaces, инвариантами, ADR и ограничениями.
- **[DOC-002] 🔴 MUST** — documentation обновляется в том же task commit, если затронуты documented behaviour, contract, structure, dependency, invariant или limitation.
- **[ADR-001] 🔴 MUST** — долгосрочное или межмодульное архитектурное решение имеет ADR.
- **[ADR-002] 🔴 MUST** — изменение accepted architectural decision требует нового или обновлённого ADR.

## 17. Bug fixes

- **[BUG-001] 🔴 MUST** — bugfix требует regression test.
- **[BUG-002] 🔴 MUST** — агент не исправляет проблему, причину которой он не установил.
- **[BUG-003] 🔴 MUST** — проблему нужно воспроизвести или документировать, почему это невозможно.
- **[BUG-004] 🔴 MUST** — root cause локализован и описан.
- **[BUG-005] 🔴 MUST** — regression test падает до исправления и проходит после него.
- **[BUG-006] 🔴 MUST** — добавление ?. везде или sleep для flaky test не считается исправлением без root cause.

Workflow:

~~~text
воспроизвести → локализовать → root cause → regression test
→ test падает → исправить root cause → verification
~~~

## 18. Automation и CI

- **[AUTO-001] 🔴 MUST** — AUTOMATION.md соответствует реально существующим scripts и CI.
- **[AUTO-002] 🔴 MUST** — AI-agent не изменяет lint, tests, architecture checks, CI gates, policy configuration или verification scripts только для прохождения своей реализации.
- **[AUTO-003] 🔴 MUST** — изменение gate допускается только если это scope текущей задачи.
- **[AUTO-004] 🔴 MUST** — добавление, изменение или удаление обязательного gate требует одновременного обновления AUTOMATION.md.
- **[AUTO-005] 🔴 MUST** — AUTOMATION.md, package.json, CI configuration, scripts/checks/ и policy/rules-map.yaml не расходятся.
- **[AUTO-006] 🔴 MUST** — exit codes стандартизированы: 0 = pass, 1 = rule violation, 2 = checker/configuration/infrastructure error.
- **[AUTO-007] 🔴 MUST** — checker не скрывает ошибки и не возвращает 0 при нарушении.
- **[AUTO-008] 🟡 SHOULD** — проект имеет единый verification entrypoint.
- **[AUTO-009] 🔴 MUST** — PR нельзя merge до прохождения обязательных CI checks.
- **[AUTO-010] 🔴 MUST** — агент не отключает tests, ослабляет lint rules, удаляет checks, меняет thresholds или добавляет ignore ради CI.

Минимальный порядок verify:

~~~text
format:check → lint → typecheck → test hygiene
→ unit → integration → architecture → build
~~~

## 19. Definition of Done

- **[DOD-001] 🔴 MUST** — пользовательский сценарий работает через затронутые слои.
- **[DOD-002] 🔴 MUST** — acceptance criteria выполнены и scope соблюдён.
- **[DOD-003] 🔴 MUST** — бизнес-правила, integration и главный E2E покрыты тестами.
- **[DOD-004] 🔴 MUST** — bugfix имеет regression test.
- **[DOD-005] 🔴 MUST** — security, API contract и migrations проверены, если применимо.
- **[DOD-006] 🔴 MUST** — README и ADR обновлены, если затронуты.
- **[DOD-007] 🔴 MUST** — pnpm verify и обязательные CI checks проходят.
- **[DOD-008] 🔴 MUST** — diff соответствует одной логической задаче.

## 20. Правила для AI-агентов

- **[AGENT-001] 🔴 MUST** — перед работой прочитать RULES.md, AUTOMATION.md, task contract, architecture overview, relevant ADR, relevant tests и README затронутого модуля.
- **[AGENT-002] 🔴 MUST** — не расширять scope самостоятельно.
- **[AGENT-003] 🔴 MUST** — не менять архитектуру самостоятельно.
- **[AGENT-004] 🔴 MUST** — не ослаблять проверки.
- **[AGENT-005] 🔴 MUST** — перед завершением запускать pnpm verify.
- **[AGENT-006] 🔴 MUST** — не удалять failing test ради прохождения реализации.
- **[AGENT-007] 🔴 MUST** — не делать speculative refactoring несвязанных компонентов.
- **[AGENT-008] 🔴 MUST** — при конфликте task с RULES.md, ADR или contract сделать STOP, сообщить владельцу и не придумывать компромисс.
- **[AGENT-009] 🔴 MUST** — не менять public contract вне задачи.
- **[AGENT-010] 🔴 MUST** — до изменения определить затронутые слои, инварианты, tests, migration/security/API compatibility impact.

## 21. Структура документации

~~~text
/
├── AGENTS.md
├── RULES.md
├── AUTOMATION.md
├── policy/
│   └── rules-map.yaml
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── development/
│   ├── product/
│   └── tasks/
└── src/
~~~

RULES.md описывает инженерные инварианты. Стек хранится в docs/architecture/tech-stack.md. Mapping RULE-ID → enforcement → checks хранится в policy/rules-map.yaml.
