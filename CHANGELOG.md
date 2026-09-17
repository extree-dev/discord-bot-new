# Changelog

Формат по [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/), версии — по [Semantic Versioning](https://semver.org/lang/ru/).

Текущую версию показывает команда `/version`, она же логируется при старте бота и берётся из `package.json`.

## [Unreleased]

## [2.0.0] — инфраструктурный рефакторинг

### ⚠️ Важное изменение (breaking)

- Хранение конфигурации переведено с файлов `data/*.json` на **PostgreSQL**. Бот больше не запустится без рабочего `DATABASE_URL`. Для переноса существующих данных — `npm run db:migrate-json`.

### Добавлено

- `Dockerfile` и `docker-compose.yml` — контейнеризация бота вместе с PostgreSQL.
- eslint + prettier + CI на GitHub Actions (с сервисом PostgreSQL для тестов).
- Unit-тесты на встроенном `node:test` для чистой бизнес-логики.
- `README.md` с инструкциями по установке и настройке.
- `utils/pgStore.js` — атомарный read-modify-write через транзакцию с `SELECT ... FOR UPDATE` (защита от гонок даже при нескольких инстансах бота).
- Публичный API `security/index.js` (`getConfig`, `updateConfig`, `createBackup`, `listBackups`, `restoreBackup`, `VERIFY_BUTTON_ID`) — команды и скрипты настройки больше не обращаются к внутренним файлам `security/` напрямую.

### Изменено

- Устранена гонка read-modify-write в JSON-хранилище (была до перехода на PostgreSQL) — атомарная запись через отдельную очередь на файл.
- `tickets/tickets.js` и `voice/tempChannels.js` разделены на `model.js` (домен: правила, создание/закрытие тикета, действия над комнатой) и `handlers.js` (роутинг Discord-взаимодействий через карту `customId → функция` вместо цепочки `if/else`).
- `index.js`: graceful shutdown по `SIGINT`/`SIGTERM` (закрывает соединение с Discord и пул PostgreSQL).

## [1.0.0] — первый релиз

- Система безопасности: anti-nuke, raid shield, audit log, automod, верификация новых участников, автобэкап структуры сервера.
- Система тикетов поддержки с выбором темы, взятием в работу и архивом переписки.
- Временные голосовые комнаты с полным набором действий владельца (лок, скрытие, лимит, кик, блок, передача владения).
- Команды модерации: `/ban`, `/kick`, `/timeout`, `/warn`, `/warnings`, `/clear`, `/unban`, `/backup`, `/security-status`.
