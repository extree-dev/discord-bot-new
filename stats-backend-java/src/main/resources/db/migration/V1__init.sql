-- V1: начальная схема Extree Stats — 1:1 с ensureSchema() из
-- ../stats-backend/db.js (Node). Все CREATE TABLE IF NOT EXISTS /
-- ALTER TABLE ... IF NOT EXISTS — безопасно выполняется и на пустой БД
-- (новый стенд), и на проде, где схему уже создал Node-овый db.js
-- (тогда Flyway просто запишет baseline и не будет пересоздавать таблицы,
-- см. spring.flyway.baseline-on-migrate в application.yml).
--
-- После перехода на Java stats-backend/ удаляется, и этот файл остаётся
-- единственным источником схемы. Будущие изменения схемы — новыми
-- V2__…sql, V3__…sql в этом же каталоге, не правкой V1.

CREATE TABLE IF NOT EXISTS stats_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified_at TIMESTAMPTZ,
    riot_puuid TEXT,
    riot_linked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stats_email_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stats_known_locations (
    user_id TEXT NOT NULL REFERENCES stats_users(id) ON DELETE CASCADE,
    country TEXT NOT NULL,
    city TEXT,
    last_ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, country)
);

CREATE TABLE IF NOT EXISTS stats_login_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    ip TEXT,
    country TEXT,
    city TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- "Remember me" переживает detour через подтверждение нового места входа
-- (stats_login_codes) — выбор из исходной формы входа нужно помнить до
-- confirm-location, иначе чекбокс молча забывался бы для всех, кому
-- попался незнакомый IP.
ALTER TABLE stats_login_codes ADD COLUMN IF NOT EXISTS remember BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS stats_password_resets (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES stats_users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stats_email_change_codes (
    user_id TEXT PRIMARY KEY REFERENCES stats_users(id) ON DELETE CASCADE,
    new_email TEXT NOT NULL,
    code TEXT NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stats_login_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES stats_users(id) ON DELETE CASCADE,
    ip TEXT,
    country TEXT,
    city TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stats_login_events_user_created_idx
    ON stats_login_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stats_support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES stats_users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE stats_support_tickets ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';
ALTER TABLE stats_support_tickets ADD COLUMN IF NOT EXISTS view_token TEXT;
UPDATE stats_support_tickets SET view_token = md5(random()::text || clock_timestamp()::text || id)
    WHERE view_token IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stats_support_tickets_view_token_key ON stats_support_tickets (view_token);

-- Короткий человекочитаемый номер тикета (#42) для UI/писем/URL админки
-- вместо необфусцированного UUID id — BIGSERIAL сам бэкфиллит
-- существующие строки при ADD COLUMN. status всё ещё просто TEXT без
-- CHECK (см. CREATE TABLE выше) — третье значение 'in_progress' не
-- требует миграции схемы, только правки в validation.js/server.js (Node).
ALTER TABLE stats_support_tickets ADD COLUMN IF NOT EXISTS ticket_number BIGSERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS stats_support_tickets_ticket_number_key
    ON stats_support_tickets (ticket_number);

CREATE TABLE IF NOT EXISTS stats_support_ticket_replies (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES stats_support_tickets(id) ON DELETE CASCADE,
    author TEXT NOT NULL CHECK (author IN ('user', 'admin')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stats_support_ticket_replies_ticket_idx
    ON stats_support_ticket_replies (ticket_id, created_at ASC);

-- Готовые ответы для админки тикетов — общий пул на всех админов (не
-- per-user), поэтому без owner_id: это шаблоны организации, а не личные
-- заметки конкретного сотрудника.
CREATE TABLE IF NOT EXISTS stats_canned_responses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- name/nickname добавлены через ALTER TABLE ADD COLUMN IF NOT EXISTS, а не
-- в теле CREATE TABLE stats_users — в проде эта таблица уже существует с
-- зарегистрированными аккаунтами. UNIQUE-индекс на nickname допускает любое
-- число NULL (у аккаунтов, заведённых до этой функции, nickname пуст) —
-- это штатное поведение Postgres для UNIQUE, не дыра.
ALTER TABLE stats_users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE stats_users ADD COLUMN IF NOT EXISTS nickname TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS stats_users_nickname_key ON stats_users (nickname);