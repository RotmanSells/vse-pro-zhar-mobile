# Dependency rules

## Разрешённые зависимости

Default policy: DENY. Межслойная зависимость разрешена только если она явно перечислена в разделе Allowed dependencies.

~~~text
Presentation → Application
Application → Domain
Infrastructure → Application
Infrastructure → Domain
Composition root → все необходимые реализации
~~~

## Явно запрещённые зависимости

~~~text
Application → Infrastructure
Presentation → Infrastructure
Domain → Application
Domain → Infrastructure
Domain → Presentation
Domain → React / React Native / Next.js
Domain → database / ORM
Presentation → database
Presentation → repository implementation
~~~

Отсутствие зависимости в Allowed dependencies не означает разрешение. Новая межслойная зависимость требует обновления этого документа и, если решение архитектурное, ADR.

## Cross-module boundaries

Модуль не импортирует internal-файлы другого модуля.

Запрещено:

~~~text
orders/application/* → cart/infrastructure/*
orders/domain/* → users/domain/internal/*
~~~

Разрешённое межмодульное взаимодействие проходит через:

- public application interface;
- explicit port;
- shared contract;
- domain/application event;
- специально определённый public module API.

Прямой импорт cart/src/internal/something.ts из orders запрещён. Модуль публикует явный public API.

## Запрещённые зависимости

~~~text
Domain → Infrastructure
Domain → Presentation
Domain → React / React Native / Next.js
Domain → database / ORM
Presentation → database
Presentation → repository implementation
Domain/Application → конкретный внешний provider SDK
~~~

## Ports and adapters

Interfaces/ports определяются в Domain или Application. Реализации находятся в Infrastructure.

Примеры:

~~~text
Domain/Application: PaymentGateway
Infrastructure: YooKassaPaymentGateway

Domain/Application: SmsSender
Infrastructure: SmsProviderAdapter

Application: OrderRepository
Infrastructure: PostgresOrderRepository
~~~

Каждый adapter валидирует внешние данные до передачи их в Application или Domain.

## Проверка

Архитектура будет проверяться автоматически через test:architecture и policy/rules-map.yaml.
