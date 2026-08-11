# AGENTS.md

# Инструкции для AI-агентов проекта

AGENTS.md — входная точка для AI coding agents. Он не заменяет RULES.md и AUTOMATION.md.

## Перед работой

Агент всегда обязан прочитать:

1. RULES.md.
2. AUTOMATION.md.

Для конкретной задачи агент обязан прочитать, если соответствующие файлы существуют:

3. Current task manifest, validated against task schema.
4. Architecture overview и dependency-rules.
5. Relevant ADR.
6. README затронутого модуля.
7. Relevant tests.

Task Contract — это schema формата задачи, а Task Manifest — конкретная задача. Schema хранится в contracts/tasks/task.schema.json и валидирует YAML-файл из docs/tasks/.

Перед изменением агент определяет:

- пользовательский сценарий;
- границы и declared scope;
- затронутые слои;
- существующие инварианты;
- необходимые unit/integration/E2E tests;
- migration, security и API compatibility impact;
- необходимость ADR и обновления документации.

## Во время работы

- Не расширять scope самостоятельно.
- Не менять архитектуру самостоятельно.
- Не менять public contract вне задачи.
- Не ослаблять lint, tests, architecture checks, CI gates или policy.
- Не удалять failing test ради прохождения реализации.
- Не исправлять bug до установления root cause.
- Не делать speculative refactoring несвязанных компонентов.
- Не использовать секреты в коде, тестах, логах или fixtures.
- Поддерживать task manifest, RULES.md, AUTOMATION.md и rules-map.yaml согласованными.
- Соблюдать TDD для бизнес-логики и bugfixes.
- Обновлять README и ADR в том же task commit, если они затронуты.

## При конфликте

Если task противоречит RULES.md, accepted ADR, API contract, DB schema или policy:

```text
STOP
→ сообщить владельцу проекта
→ описать источник конфликта
→ не придумывать компромисс самостоятельно
```

Если причина проблемы не установлена, агент не исправляет её. Сначала нужно воспроизведение, доказательства и root cause.

## Перед завершением

Агент обязан:

1. Запустить pnpm verify.
2. Проверить соответствие diff task scope.
3. Проверить тесты, документацию, ADR и contract impact.
4. Сообщить, какие проверки прошли и какие невозможно запустить.
5. Не объявлять задачу завершённой при ненулевом exit code обязательной проверки.

Стандартизированные exit codes:

- 0 — проверка пройдена;
- 1 — обнаружено нарушение правила;
- 2 — ошибка конфигурации, инфраструктуры или checker.
