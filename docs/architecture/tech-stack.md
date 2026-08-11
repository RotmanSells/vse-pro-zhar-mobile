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
- Zod или эквивалентная runtime validation.
- PostgreSQL.
- Параметризованные SQL-запросы или безопасный query builder/ORM.

## Admin

- Next.js или другой явно утверждённый web-клиент.
- Административные capabilities реализуются внутри соответствующих vertical slices.

## Testing

- Unit/component tests.
- Integration tests с изолированной PostgreSQL.
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

Конкретная библиотека может быть заменена только через ADR и обновление этого документа.

