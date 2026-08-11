# Target technology stack

## Mobile

- React Native.
- Expo.
- TypeScript в strict mode.
- Expo Router.
- TanStack Query для server state.
- Zustand для локального состояния.
- Zod для runtime validation.
- React Hook Form для форм.
- Reanimated для анимаций.
- FlashList или FlatList для больших списков.
- Expo SecureStore для токенов.

## API

- Node.js.
- TypeScript.
- REST API.
- OpenAPI как machine-readable API contract.
- Zod для runtime validation.
- PostgreSQL.
- PostgreSQL access через pg и параметризованные SQL-запросы; ORM не выбран.

## Admin

- Next.js для административного web-клиента.
- Административные capabilities реализуются внутри соответствующих vertical slices.

## Testing

- Unit/component tests.
- Integration tests с изолированной PostgreSQL.
- Jest и React Native Testing Library для unit/component tests.
- E2E tests для главного сценария milestone.
- Security tests для применимых рисков.
- Contract tests для внешних providers.
- Performance tests перед production release.

## Tooling

- pnpm.
- ESLint.
- Prettier.
- GitHub Actions.
- EAS Build для мобильных сборок.

Архитектурно значимый компонент стека может быть заменён только через ADR и обновление этого документа.

Архитектурно значимыми считаются React Native/Expo, Node.js, PostgreSQL, REST/OpenAPI, основная архитектура, persistence approach и системный state-management approach.

Обычная implementation dependency может быть изменена в рамках task, если это не меняет архитектуру, public contract или значимый engineering invariant.
