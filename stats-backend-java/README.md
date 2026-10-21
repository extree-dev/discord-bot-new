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
adapter/out/crypto/              — AES-GCM сессия и scrypt-пароли, совместимые с session.js/users.js
adapter/out/mail/                — SMTP (iCloud), совместимо с mailer.js
```

## Что уже перенесено

- `GET /api/session` — читает и расшифровывает сессионную cookie.
- `GET /api/account/me` — профиль + `isAdmin` (как в PR #315).
- `POST /auth/register` / `/auth/resend-code` / `/auth/verify` —
  регистрация email+паролем с кодом подтверждения; `verify` сразу логинит
  (ставит ту же cookie), как и Node. **Пока без** geo/`loginLocations`
  ("известное место входа") — понадобится вместе с переносом полного
  `/auth/login` (следующий срез), см. комментарий в `RegistrationService`.

Все проверены на совместимость с уже выпущенным Node-сервисом:
`AesGcmSessionCodecTest` расшифровывает (и теперь также выпускает —
`encrypt()`) токен, реально сгенерированный
`node -e "require('./stats-backend/session').encryptSession(...)"`;
`ScryptPasswordHasherTest` проверяет хеш, реально сгенерированный
`require('./stats-backend/users.js').hashPassword(...)`; живой smoke-тест
(Postgres + собранный jar + curl) прогнан вручную для всего слайса
register → verify, включая то, что выпущенная Java-сервисом cookie
расшифровывается тем же Node'овым `decryptSession`. Если эти проверки
когда-нибудь расходятся — переключать трафик нельзя.

## Что дальше (в следующих PR)

1. Полный `/auth/login` (известное место входа, Turnstile, rate-limit).
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
STATS_MAIL_USER=<тот же iCloud-адрес, что у Node-сервиса> \
STATS_MAIL_APP_PASSWORD=<тот же app-specific пароль> \
mvn spring-boot:run
```
