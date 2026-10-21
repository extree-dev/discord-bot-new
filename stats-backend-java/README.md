# stats-backend (Java)

Фаза 1 перехода `stats-backend/` (Node/Express) на Java с гексагональной
архитектурой (порты/адаптеры). **Ничего в проде пока не меняет** —
Node-версия (`../stats-backend/`) остаётся единственным сервисом,
реально обслуживающим трафик на `stats.extree.tech`; этот модуль не
подключён ни в `docker-compose.yml`, ни в `web/Caddyfile`.

## Зачем так, а не всё сразу

Полный перенос REST API — десятки эндпоинтов, email-коды, Riot OAuth,
Turnstile, rate-limit, около 15 файлов на Node — это недели работы, а не
один PR. Переписывать всё одним рывком, да ещё и без промежуточной
проверки, слишком рискованно для живого продакшена (см. историю
сегодняшнего дня: один непроверенный инфраструктурный шаг уже дважды
ронял VPS). Вместо этого — по вертикальному срезу за раз, каждый
проверяется на совместимости с тем, что уже выдал Node, и только потом
переключается трафик.

## Структура (hexagonal / ports & adapters)

```
domain/                          — чистые доменные объекты, без Spring/JDBC
application/port/in/             — входные порты (use case интерфейсы)
application/port/out/            — выходные порты (что нужно от внешнего мира)
application/service/             — реализация input-портов поверх output-портов
adapter/in/web/                  — REST-контроллеры (Spring MVC)
adapter/out/persistence/         — JDBC-реализации репозиториев
adapter/out/crypto/              — AES-GCM сессия, совместимая с session.js
```

## Что уже перенесено

- `GET /api/session` — читает и расшифровывает сессионную cookie.
- `GET /api/account/me` — профиль + `isAdmin` (как в PR #315).

Оба read-only, оба проверены на совместимость с уже выпущенными Node
cookie: `AesGcmSessionCodecTest` расшифровывает токен, реально
сгенерированный `node -e "require('./stats-backend/session').encryptSession(...)"`
— если этот тест когда-нибудь падает, значит шифрование разошлось и
переключать трафик нельзя.

## Что дальше (в следующих PR)

1. Регистрация/вход (email+пароль, коды подтверждения) — самое объёмное:
   нужны email-адаптер (SMTP через iCloud, см. mailer.js) и ещё 5-6 таблиц.
2. Смена email/пароля, история входов.
3. Тикет-платформа (создание/ответ/статусы/canned responses).
4. Riot OAuth + Turnstile.
5. Только после того, как Java-сервис покрывает весь REST API и прошёл
   полноценную проверку — переключение `web/Caddyfile`/
   `docker-compose.yml` на него, с Node-версией как fallback на случай
   отката.

Миграции схемы БД ("как обще принято", отдельная задача) — туда же:
пока оба сервиса читают одну и ту же БД, которую мигрирует Node (db.js,
идемпотентный DDL), заводить версионированные миграционные файлы имеет
смысл одновременно с переносом эндпоинтов, которые меняют схему
(регистрация, тикеты), а не отдельно от них.

## Запуск локально

```
DATABASE_URL_JDBC=jdbc:postgresql://localhost:5432/discordbot \
POSTGRES_USER=discordbot \
POSTGRES_PASSWORD=discordbot \
STATS_SESSION_SECRET=<тот же секрет, что у Node-сервиса> \
SUPPORT_ADMIN_EMAILS=admin@example.com \
STATS_BACKEND_JAVA_PORT=8081 \
mvn spring-boot:run
```
