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
adapter/in/web/                  — REST-контроллеры (Spring MVC), rate-limit фильтр
adapter/out/persistence/         — JDBC-реализации репозиториев
adapter/out/crypto/              — AES-GCM сессия и scrypt-пароли, совместимые с session.js/users.js
adapter/out/mail/                — SMTP (iCloud), совместимо с mailer.js
adapter/out/geo/                 — офлайн geo-по-IP (страна), те же данные, что geoip-lite у Node
adapter/out/turnstile/           — Cloudflare Turnstile siteverify
```

## Что уже перенесено

- `GET /api/session` — читает и расшифровывает сессионную cookie.
- `GET /api/account/me` — профиль + `isAdmin` (как в PR #315).
- `POST /auth/register` / `/auth/resend-code` / `/auth/verify` —
  регистрация email+паролем с кодом подтверждения; `verify` сразу логинит
  (ставит ту же cookie), как и Node.
- `POST /auth/login` / `/auth/login/resend-code` / `/auth/login/confirm-location` —
  вход email+паролем, Turnstile, "известное место входа" (geo по стране)
  с кодом подтверждения на новый IP/страну, rate-limit (300/5мин на IP,
  как authRateLimiter у Node) на `/auth` и `/api`.
- `GET /auth/logout` — чистит сессионную cookie, редирект на `/`.
- `POST /auth/forgot-password` / `/auth/reset-password` — сброс пароля по
  ссылке (не 6-значный код — 32 случайных байта в hex, см.
  `JdbcPasswordResetRepository`), anti-enumeration (один и тот же ответ
  независимо от того, существует ли аккаунт). Успешный сброс сразу логинит.
- `POST /auth/account/change-email` / `/resend-email-change-code` /
  `/confirm-email-change`, `POST /auth/account/change-password`,
  `GET /api/account/login-history` — настройки аккаунта, все требуют
  действующую сессию + (для смены email/пароля) текущий пароль —
  тот же "step-up" приём, что requireSession в server.js.
- `POST /api/support/tickets`, `GET /api/support/tickets/:token`,
  `POST /api/support/tickets/:token/reply` — публичная сторона
  тикет-платформы (без входа, или с сессией — тогда email берётся из
  аккаунта, тело игнорируется, чтобы нельзя было подменить отправителя).
  Просмотр/ответ по секретному `view_token`, не по человекочитаемому
  номеру тикета (тот легко перебирается).
- `GET /api/admin/tickets`, `GET /api/admin/tickets/:number`,
  `POST /api/admin/tickets/:number/reply`, `/status`,
  `GET`/`POST /api/admin/canned-responses`,
  `DELETE /api/admin/canned-responses/:id` — админка, email в
  `SUPPORT_ADMIN_EMAILS` (`SupportAdminEmails`, общий с `/api/account/me`
  `isAdmin`); 401 (нет сессии) и 403 (сессия есть, но не админ)
  различаются, как и requireAdmin в Node. Первый ответ админа сдвигает
  тикет из `open` в `in_progress`.

**Известное отклонение (осознанное, не забытое):** geo-определение страны
здесь читает только `geoip-country(6).dat` (те же файлы, что у geoip-lite,
но country-уровень, ~14MB, см. `IpCountryGeoLookup`), а не city-уровень
(`geoip-city(6).dat`, ~135MB), который Node использует по умолчанию через
geoip-lite. Для подавляющего большинства реальных IP оба источника дают
одну и ту же страну; расхождение возможно на редких/anycast-диапазонах,
которых нет в country-файле, но есть в более подробном city-файле (или
наоборот). `city` в письмах от этого сервиса поэтому всегда пустой —
шаблон писем уже поддерживает "страна без города" (см. `formatLocation`
в mailer.js), деградация чисто косметическая. Сама проверка "известного
места" по-прежнему устроена так, что отсутствие данных НЕ блокирует вход
(fail open) — то же поведение, что и у Node.

Все проверены на совместимость с уже выпущенным Node-сервисом:
`AesGcmSessionCodecTest` расшифровывает (и теперь также выпускает —
`encrypt()`) токен, реально сгенерированный
`node -e "require('./stats-backend/session').encryptSession(...)"`;
`ScryptPasswordHasherTest` проверяет хеш, реально сгенерированный
`require('./stats-backend/users.js').hashPassword(...)`;
`IpCountryGeoLookupTest` сверяет страну для полусотни IP (включая границы
диапазонов, приватные адреса, IPv6) с реальной библиотекой geoip-lite,
принудительно направленной на те же country-файлы через `GEODATADIR`;
живой smoke-тест (Postgres + собранный jar + curl, Turnstile — через
официальные тестовые ключи Cloudflare) прогнан вручную для регистрации,
входа ("неизвестное место → код на почту → confirm-location → cookie с
правильным Max-Age/sameSite"), настроек аккаунта (смена пароля → смена
email с подтверждением на новый адрес → забыл пароль → сброс по ссылке
→ вход с финальным паролем, одной цепочкой на одном аккаунте) и
тикет-платформы (создание без сессии → публичный просмотр без email в
ответе → ответ пользователя → список/детали в админке с email → ответ
админа с авто-переходом open→in_progress → смена статуса → отклонённый
ответ на закрытый тикет → canned responses create/list/delete →
401-без-сессии vs 403-не-админ → подмена email в теле запроса
подтверждённым пользователем игнорируется), включая то, что выпущенная
Java-сервисом cookie расшифровывается тем же Node'овым `decryptSession`.
Если эти проверки когда-нибудь расходятся — переключать трафик нельзя.

## Что дальше (в следующих PR)

1. Riot OAuth + Turnstile config endpoints.
2. Только после того, как Java-сервис покрывает весь REST API и прошёл
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
TURNSTILE_SECRET_KEY=<тот же ключ, что у Node-сервиса> \
mvn spring-boot:run
```
