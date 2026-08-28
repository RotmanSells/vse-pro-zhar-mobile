# Все Про Жар — Product Definition

## 1. Purpose

Этот документ — единый canonical product document для «Все Про Жар». Он фиксирует
текущее, согласованное понимание продукта перед последующей детализацией user flows,
правил, контрактов, roadmap и vertical slices. Он описывает продуктовые решения, а не
архитектуру, API, schema БД или реализацию.

Первый публичный release предназначен для реальных клиентов. Дата запуска не
зафиксирована. Все решения здесь имеют приоритет над prototype; при появлении
machine-readable production contracts они станут источником истины для своей области.

## 2. Product Summary

«Все Про Жар» — mobile ordering application одного grill-ресторана. Production
работает для одной физической точки в Краснодаре: **ул. Бабушкина, 181**. Ресторан
работает ежедневно с **10:00 до 22:00**.

Первый release — **pickup only**. Пользователь выбирает блюда, оформляет и оплачивает
самовывоз, получает статусы заказа и участвует в программе лояльности и геймификации.
Геймификация — часть core product, а не необязательный дополнительный слой.

Production не является сетью, marketplace или приложением для сторонних ресторанов.
В нём нет выбора филиала, customer web ordering, отдельного kitchen, courier или
operator/call-center application. Кухня использует iiko.

## 3. Sources of Truth

Приоритет источников:

1. Owner decisions, зафиксированные в этой задаче.
2. Этот документ после его утверждения.
3. RULES.md и accepted ADR — только для engineering architecture.
4. Machine-readable production contracts после их появления — в пределах их области.
5. Prototype.
6. Implementation.

Prototype — functional и visual reference, но не production specification. Его demo
data, hardcoded constants, secrets, credentials, backend design и database design не
являются требованиями. При расхождении prototype с owner decision сохраняется owner
decision, а различие документируется в разделе 27.

## 4. Prototype Reference

Рабочий prototype расположен локально: `/Users/rotman/Desktop/prototypes`.

Исследованы его README, customer client (`index.html` и client JavaScript), Web Admin
(`admin.html`), Node.js REST API, PostgreSQL migrations и smoke tests. Prototype
содержит customer web UI, Admin Web, backend и PostgreSQL; его архитектура не
переносится в production.

Для Mobile prototype — canonical visual reference. Его утверждённый visual design
MUST быть сохранён: colors, typography, layout, navigation concept, icons, animations,
component behavior и общий UX. Изменения допустимы только там, где их требует React
Native или native platform behaviour. Admin не обязан быть pixel-perfect копией, но
prototype остаётся reference его функций и общего visual direction.

## 5. First Release Scope

В first release входят:

- iOS application и Android application;
- Web Admin;
- Backend API и PostgreSQL;
- menu, local search, cart, pickup checkout и online SBP payment;
- phone/SMS OTP authentication для создания заказа;
- customer profile, order history, favorites и repeat order;
- promos, угольки, XP/ranks, wheel, quests и segments;
- integration с iiko для availability и kitchen order/status;
- transactional и marketing push, SMS только для OTP;
- operational Admin, analytics и lightweight service health.

First release не включает delivery, reviews, customer web ordering, несколько точек,
сторонние рестораны, отдельные kitchen/courier/operator applications, cash или
payment-on-pickup, email и login через password/Apple/Google.

## 6. Actors and Systems

| Actor/system | Responsibility                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Guest        | Просматривает menu, ищет, собирает cart, применяет promo и открывает checkout.                       |
| Customer     | После phone/SMS OTP создаёт и оплачивает order, получает статусы, использует loyalty и gamification. |
| Admin        | Выполняет business operations: menu, promos, customers, loyalty, quests, wheel, segments и messages. |
| Super admin  | Наблюдает за business и service health; не изменяет business data.                                   |
| Backend      | Authoritative source checkout validation, final price, rewards и integrations.                       |
| iiko         | Source of truth operational kitchen availability и исполнения заказа.                                |
| SBP provider | Подтверждает online payment; конкретный provider пока TBD.                                           |

### Catalog authority and implementation boundary

Для каталога единственным источником истины является наш Backend/PostgreSQL. Это
относится к Categories, Products, названиям, ценам, descriptions/ingredients, weight,
approved labels (`new`/`hit`), изображениям и `admin_enabled`. Admin изменяет эти данные
только через Backend-контракт, а Mobile показывает только подтверждённые Backend
ответы. `admin_enabled` означает видимость в нашем каталоге и не означает
операционную доступность или orderability.

iiko владеет только operational availability, stop-list, kitchen execution и kitchen
statuses. Admin не меняет kitchen statuses вручную и не дублирует iiko-операции; до
появления соответствующего Backend/iiko-контракта Admin Orders может быть только
read-only/diagnostic surface.

Prototype используется только как visual reference. Его categories, products, prices,
orders и localStorage нельзя переносить в runtime. Production runtime не содержит mock
catalog, demo products, fake orders, sample prices или hardcoded fallback data. Если
Backend/provider-контракт ещё не готов, UI показывает явный placeholder, empty или error
state без выдуманных строк и записей. Product details, imagery и catalog visibility
остаются отдельными границами и не объединяются в новый произвольный Product flow.

Shared admin account пока является owner decision. Индивидуальная account system не
проектируется в этой задаче. Admin authentication mechanism: TBD. Email/username +
password не является approved production decision; agent не должен выбирать механизм
authentication до отдельного owner decision.

## 7. Mobile Experience

Mobile application ориентирована на русский язык, RUB и Moscow timezone. Основная
навигационная концепция и visual behaviour следуют prototype: меню, геймификация,
профиль и cart должны быть легко доступны из основного mobile experience.

Критические mobile flows владелец принимает вручную на физическом телефоне через Expo Go
против локального Backend. Автоматические Android/device E2E через Maestro отключены и не
являются gate, пока владелец отдельно не включит их обратно. При плохом интернете application
должна оставаться полезной для просмотра доступного cached menu, но не должна обещать, что
cache отражает текущую availability или итог checkout.

## 8. Authentication and Profile

Guest может:

- смотреть menu;
- использовать local search;
- собирать cart;
- применять promo;
- открыть checkout.

Для создания order нужна authentication по phone и SMS OTP. Password, email,
Apple Sign In и Google Sign In отсутствуют. Guest cart сохраняется после закрытия
application и после login.

Name обязателен при первом order. Birthday optional. Saved delivery addresses не нужны,
так как delivery отсутствует. Customer может удалить account из application.

Профиль включает как минимум customer identity, order history, favorites, угольки,
XP/rank, quests и wheel activity в объёме, необходимом для customer experience.

### Favorites and Repeat Order

Favorites нужны. Repeat Order нужен, но повторяет order по **current** product,
price и availability: historical prices не копируются. Если product больше не
доступен или изменился, customer должен исправить cart до checkout. Reviews полностью
out of scope.

### Legal Documents, Consent and Account Deletion

Privacy Policy и User Agreement принимаются при первой registration. Для каждого
принятия хранятся `document_version` и `accepted_at`. Marketing consent — отдельное
согласие и не заменяет принятие обязательных legal documents.

При account deletion PII должно быть anonymized или deleted. Financial и order history,
которую необходимо сохранить по допустимым требованиям, может сохраняться только в
обезличенной или иной допустимой форме.

## 9. Menu and Search

Menu имеет ровно два уровня: **Category → Product**. Subcategories отсутствуют, один
product относится к одной category.

Product показывает name, description/ingredients, price, weight, одну обязательную main image, category,
new/hit и availability. Emoji из prototype — demo-only и не являются production
требованием.

Search выполняется локально по name, description/ingredients и category. Search history
не требуется для first release.

## 10. Cart and Pricing

Guest cart сохраняется после закрытия application и после authentication. Cart
поддерживает quantity и один общий comment к order. Tips, cutlery selection, service
fee и packaging fee отсутствуют. Минимальной суммы заказа нет.

Концептуальная формула total:

```text
products − discounts − used embers
```

Backend является authoritative source final price. Mobile total — только
предварительное отображение и не trusted для создания order.

## 11. Pickup

Pickup location фиксирован: **Краснодар, ул. Бабушкина, 181**. Выбора branch нет.

Доступны два режима:

- ASAP;
- scheduled pickup только на текущий день, slots по одному часу.

Последний scheduled pickup — не позже 22:00. Preparation time задаёт Admin, но ASAP
не вычисляется через обязательный minimum preparation time. В 21:40 ASAP допустим;
после closing order на следующий день оформить нельзя. После 21:30 новые orders должны
блокироваться, если ASAP уже недоступен. TBD остаётся только точная формализация
пограничного алгоритма между 21:30 и 22:00.

## 12. Promo

Admin управляет promo. Поддерживаются percent, fixed и gift promo. Promo может
применяться ко всему order, конкретным products или categories.

Admin настраивает validity period, minimum subtotal, one-use-per-user, first-order,
usage limit и applicable products/categories. Одновременно используется не более одного
promo. Promo и embers не совмещаются. Backend обязательно повторно валидирует promo
при checkout.

## 13. Loyalty — «угольки»

Bonus currency называется **угольки**. Ею можно оплатить часть order. Maximum ember
payment default — **30%**; Admin управляет loyalty settings, включая expiration policy.

Cashback зависит от rank. Угольки начисляются только после `order completed`.
Cancelled или refunded order не должен принести reward.

Admin может вручную добавить или списать угольки. Каждая manual adjustment должна
иметь amount, reason, actor и timestamp.

## 14. XP and Ranks

XP отделён от угольков: его нельзя тратить, он определяет progression/rank. XP
начисляется после `order completed`; при cancellation/refund соответствующее начисление
должно корректно откатываться.

Admin управляет XP/rank configuration, но не может вручную менять XP. Rank даёт
benefits; подтверждённый benefit — cashback. Остальные точные benefits остаются TBD.

## 15. Wheel

Wheel обязательна. Qualifying completed order от **1000 RUB** даёт максимум одно spin:
order на 2500 RUB всё равно даёт только одно. Threshold считается после discounts.
Spin выдаётся после `order completed`, не накапливается и всегда должен иметь reward.

Возможные reward: embers, XP, promo или free product. Admin настраивает rewards и
probabilities. Взаимодействие wheel threshold с ember redemption остаётся TBD.

## 16. Quests

Quests обязательны. Quest содержит condition, progress, reward и start/end date.
Поддерживаемые product examples: N orders, spend N RUB, buy product и N orders during
period. Customer может выполнять несколько quests одновременно; reward выдаётся
автоматически. Admin управляет quests.

## 17. Segments

Customer segments обязательны. Admin создаёт segments по conditions. Они используются
для marketing, analytics и push campaigns. Push campaign может быть отправлена выбранному
segment.

## 18. Payment

В first release доступен только online SBP. Cash и payment-on-pickup отсутствуют.
Конкретный SBP provider не выбран и остаётся TBD.

Ожидаемый flow: `awaiting payment` → переход в banking application → payment
confirmation → callback/webhook → success или failure. Он должен включать idempotency,
automatic expiration и refund. Exact payment timeout TBD, ориентировочно 10–15 минут.

## 19. Orders and iiko

Stop-list нужен, warehouse inventory сейчас не нужен. Visibility product определяется
как:

```text
admin_enabled AND iiko_available
```

Admin может скрыть product через `admin_enabled`. iiko является source of truth
operational kitchen availability через `iiko_available`. iiko stop-list periodically
synchronizes с нашей системой, а перед checkout backend обязательно authoritative
rechecks current availability. Если item cart стал unavailable, order нельзя создать до
исправления cart.

Наш backend создаёт order. После confirmed payment он отправляет order в iiko; unpaid
order туда не отправляется. Пока iiko не подтвердил order, customer не получает ложное
сообщение о принятии kitchen. iiko также используется для cooking/order execution
status. Menu и prices управляются нашей Admin/Backend системой. Accepted ADR-002
фиксирует iiko Cloud API contract: production auth — `POST /api/v2/access_token`
с `apiKey`, `appId`, `clientSecret`, JWT и no-refresh flow; M3 operational
context/availability — `POST /api/1/organizations`,
`POST /api/1/terminal_groups`, `POST /api/1/terminal_groups/is_alive` и
`POST /api/1/stop_lists`. Legacy `POST /api/1/access_token` с `apiLogin`
остаётся compatibility/test only по архитектурному решению проекта. Missing or
invalid Product mapping, stale/unknown state и external failure fail closed.

Conceptual order states:

- `awaiting_payment`;
- `paid`;
- `accepted`;
- `cooking`;
- `ready_for_pickup`;
- `completed`.

Exceptional states: `payment_failed`, `cancelled`. Refund имеет состояния `pending`,
`succeeded`, `failed`. Семантика `accepted` пока TBD. `completed` приходит из iiko.

Каждый status transition хранится как history record минимум с `from`, `to`, `timestamp`
и `source/actor`. Cancellation reason хранится как stable value:
`customer_request`, `item_unavailable`, `restaurant_issue`, `payment_issue` или
`other`. Customer видит понятную причину cancellation.

## 20. Cancellation and Refund

Customer может отменить order до `cooking`; после начала cooking customer cancellation
запрещена. Оплаченная отмена требует full refund. Restaurant или iiko также может
отменить order.

Если payment succeeded, но call в iiko failed, order не теряется: failure фиксируется,
поднимается critical alert и выполняются bounded automatic retries. Customer не получает
ложное accepted state. При unrecoverable failure требуется automatic full refund. Если
iiko уже unavailable до checkout, checkout и payment блокируются.

Если automatic refund завершился `failed`, это critical incident: требуется Telegram
alert и видимость для super admin.

## 21. Push / SMS

Transactional push: paid, accepted, cooking, ready for pickup, cancelled, refund
completed и payment failed.

Marketing push: promos, new products, embers, quests, wheel и campaigns. SMS
используется только для OTP. Email отсутствует.

Есть отдельный marketing consent, но одновременно owner decision говорит, что user не
может отдельно отключить marketing push. Это не разрешается этой задачей и остаётся
явным conflict/TBD до owner decision.

## 22. Admin

Sections Web Admin: Dashboard, Orders, Menu, Promos, Customers, Loyalty, Quests, Wheel,
Segments и Messages. Messages — push campaigns.

Orders в Admin предназначены прежде всего для просмотра и диагностики, а не для
дублирования iiko kitchen operations. Admin видит order, items, customer, payment,
refund, status history, iiko status и integration errors.

Admin Menu поддерживает CRUD categories и products. Product fields редактируются через
Admin, одна обязательная main image загружается file upload и заменяется только вместе с
новой картинкой. `admin_enabled` управляется Admin;
`iiko_available` — iiko.

Admin Customers/Loyalty показывает name, phone, birthday, orders, total spend, embers,
XP/rank, quests и wheel activity. Internal customer notes допустимы. User blocking пока
нет.

Super admin — observer: он не изменяет business data. Он видит lightweight service
health API, PostgreSQL, SBP/payment, iiko, SMS и push. Critical incidents отправляют
Telegram alert. Большая technical console не нужна.

## 23. Analytics

Admin analytics включает revenue, orders, average check, customers, new/repeat,
cancellations, top products, promo usage, embers earned/spent, XP, wheel analytics,
quest completion, payment failures, conversion funnel и retention.

Conversion funnel:

```text
app open → cart → checkout → payment → completed
```

## 24. Offline / Reliability

Menu, categories, prices и appropriate product-image metadata/assets могут быть cached.
Offline customer может смотреть menu, но checkout запрещён. Cached availability не
authoritative; backend повторно проверяет current state перед checkout.

Initial load — приблизительно 10–50 orders/day. Product не должен быть
overengineered. Specific SLA и performance numbers не определены.

## 25. Future Delivery

Delivery ожидается как future capability, но не входит в first release и подробно не
проектируется сейчас. В first release отсутствуют delivery addresses, zones, couriers,
fees, maps, delivery ETA и tracking. Добавление delivery потребует отдельного product
решения и последующей технической детализации.

## 26. Explicit Out of Scope

Помимо delivery и reviews, за пределами первого release находятся:

- сеть, несколько точек, выбор филиала и сторонние рестораны;
- customer web ordering;
- отдельные kitchen, courier и operator/call-center applications;
- warehouse inventory;
- passwords, email, Apple и Google login;
- cash и payment-on-pickup;
- tips, cutlery selection, service fee и packaging fee;
- saved delivery addresses и customer blocking;
- individual admin account system;
- детальное проектирование modifiers, combos/sets и delivery.

## 27. Prototype Discrepancies

### Multiple pickup points and delivery

**Prototype behavior:** customer web prototype supports delivery and pickup, exposes
four pickup points and includes delivery addresses, fees and delivery timing.

**Production decision:** one restaurant at Краснодар, ул. Бабушкина, 181; first release
is pickup only with no branch selection or delivery.

**Difference:** prototype's multi-point and delivery flows are not first-release scope.

**Reason:** owner decision defines one physical location and defers delivery.

### Guest order creation

**Prototype behavior:** guest can create an order using contact details.

**Production decision:** guest may reach checkout, but phone/SMS OTP authentication is
required before order creation; the guest cart is retained after login.

**Difference:** production introduces a mandatory authenticated checkout boundary.

**Reason:** owner decision.

### Search

**Prototype behavior:** customer UI filters by category but does not implement search.

**Production decision:** local search covers product name, description/ingredients and
category.

**Difference:** search is a first-release mobile capability beyond prototype behavior.

**Reason:** owner decision.

### Payment and iiko order flow

**Prototype behavior:** order is created directly from checkout; it has no confirmed
SBP callback/webhook and no iiko acceptance boundary.

**Production decision:** only confirmed online SBP payment leads to iiko submission;
unpaid orders are not sent and iiko confirmation is required before saying kitchen
accepted the order.

**Difference:** production has authoritative payment, idempotency, integration failure
and refund handling.

**Reason:** real-customer ordering and owner decision.

### Wheel eligibility and rewards

**Prototype behavior:** demo mode can allow a spin without a completed order, and Admin
offers configurable eligibility, limits and even a no-reward option.

**Production decision:** one qualifying completed order of at least 1000 RUB after
discounts gives at most one non-accumulating spin, and every spin has a reward.

**Difference:** demo and generic configuration behaviour do not define production rules.

**Reason:** owner decision; prototype configuration is not a business-rule source.

### Admin order operations

**Prototype behavior:** Admin can edit order status as a business operation.

**Production decision:** Admin orders are for observation and diagnostics; kitchen status
operations are not duplicated outside iiko.

**Difference:** manual order-status control is excluded from production Admin scope.

**Reason:** iiko owns kitchen execution status.

### Reviews and notification preferences

**Prototype behavior:** prototype includes UI-level notification preferences and does
not establish the production review policy.

**Production decision:** reviews are fully out of scope; marketing consent versus an
inability to disable marketing push is an unresolved owner-decision conflict.

**Difference:** prototype settings do not resolve production policy.

**Reason:** owner decisions take precedence; notification policy needs clarification.

## 28. Open Questions / TBD

- Concrete SBP provider.
- Exact payment timeout within the approximately 10–15 minute expectation.
- Exact semantics of `accepted`.
- Admin authentication mechanism; email/username plus password has not been selected.
- Exact additional rank benefits beyond cashback.
- Marketing consent and notification-preference conflict: separate consent exists, but
  customer may allegedly not disable marketing push.
- Exact formalization of the pickup boundary algorithm between 21:30 and 22:00.
- Modifiers: structure, min/max, pricing and exclusions.
- Combo/set rules and behavior.
- Wheel threshold interaction with ember redemption.
- Details of the future delivery product, intentionally deferred from this release.
