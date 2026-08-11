# Архитектурный обзор

## Назначение

Проект «Все Про Жар Mobile» — отдельное мобильное приложение для iOS и Android с переиспользованием backend-контрактов прототипа и постепенным развитием production API.

Текущий репозиторий находится на стадии инженерного фундамента: исполняемого приложения, API, БД и CI пока нет.

## Целевые приложения

~~~text
apps/mobile  — React Native + Expo клиент iOS/Android
apps/api     — Node.js + TypeScript API
apps/admin   — административный web-клиент
~~~

## Направление зависимостей

~~~text
Presentation → Application → Domain
Infrastructure → Application / Domain
~~~

- Presentation содержит экраны, UI, HTTP controllers и adapters presentation-слоя.
- Application содержит use cases, orchestration и application services.
- Domain содержит entities, value objects, business rules, domain services и ports.
- Infrastructure содержит PostgreSQL, repositories, внешние API, SMS, push, maps, payments и queues.

Domain не знает о React, React Native, Next.js, HTTP, PostgreSQL, ORM или конкретном provider.

## Вертикальный срез

Каждая пользовательская функция проходит через необходимые слои:

~~~text
Mobile/Admin UI
→ API
→ Application use case
→ Domain rules
→ Infrastructure/DB
→ Admin capabilities, если нужны
→ Unit/Integration/E2E tests
~~~

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

