# Dependency rules

## Разрешённые зависимости

~~~text
Presentation → Application
Application → Domain
Infrastructure → Application
Infrastructure → Domain
Composition root → все необходимые реализации
~~~

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

