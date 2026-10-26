// Свой пул соединений и свои таблицы — НЕ utils/db.js/utils/pgStore.js
// бота. Тот же физический Postgres-сервер (общий ради экономии ресурсов,
// см. docker-compose.yml), но код подключения продублирован по тому же
// принципу, что уже применён к session.js: Extree Stats намеренно
// независимый продукт, его данные не должны жить вперемешку с таблицами
// бота (bot_stores, dashboard_accounts), даже если физически это одна БД.
const { Pool } = require('pg');

let pool = null;
let schemaReady = null;

function getPool() {
    if (!pool) {
        pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.on('error', err => {
            console.error('stats-backend: ошибка простаивающего соединения в пуле Postgres:', err.message);
        });
    }
    return pool;
}

// riot_puuid/riot_linked_at уже в схеме, хотя привязка Riot-профиля к
// аккаунту — будущая функция (см. план в PR): добавлять колонку потом,
// на уже заполненную таблицу пользователей, лишний повод что-то сломать
// при миграции — проще сразу оставить для неё место.
//
// name/nickname добавлены через ALTER TABLE ADD COLUMN IF NOT EXISTS, а не
// в теле CREATE TABLE stats_users — в проде эта таблица уже существует с
// зарегистрированными аккаунтами (нет системы миграций, только
// идемпотентные DDL здесь), так что это единственный путь для "старой"
// и "новой" БД одновременно. UNIQUE-индекс на nickname допускает любое
// число NULL (у аккаунтов, заведённых до этой функции, nickname пуст) —
// это штатное поведение Postgres для UNIQUE, не дыра.
function ensureSchema() {
    if (!schemaReady) {
        schemaReady = getPool()
            .query(
                `CREATE TABLE IF NOT EXISTS stats_users (
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
                -- "Remember me" пережидает detour через подтверждение нового
                -- места входа (stats_login_codes) — выбор из исходной формы
                -- входа нужно помнить до confirm-location, иначе чекбокс
                -- молча забывался бы для всех, кому попался незнакомый IP.
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
                ALTER TABLE stats_users ADD COLUMN IF NOT EXISTS name TEXT;
                ALTER TABLE stats_users ADD COLUMN IF NOT EXISTS nickname TEXT;
                CREATE UNIQUE INDEX IF NOT EXISTS stats_users_nickname_key ON stats_users (nickname);
                ALTER TABLE stats_support_tickets ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';
                ALTER TABLE stats_support_tickets ADD COLUMN IF NOT EXISTS view_token TEXT;
                UPDATE stats_support_tickets SET view_token = md5(random()::text || clock_timestamp()::text || id)
                    WHERE view_token IS NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS stats_support_tickets_view_token_key ON stats_support_tickets (view_token);
                CREATE TABLE IF NOT EXISTS stats_support_ticket_replies (
                    id TEXT PRIMARY KEY,
                    ticket_id TEXT NOT NULL REFERENCES stats_support_tickets(id) ON DELETE CASCADE,
                    author TEXT NOT NULL CHECK (author IN ('user', 'admin')),
                    message TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                CREATE INDEX IF NOT EXISTS stats_support_ticket_replies_ticket_idx
                    ON stats_support_ticket_replies (ticket_id, created_at ASC);
                -- Короткий человекочитаемый номер тикета (#42) для UI/писем/URL
                -- админки вместо необфусцированного UUID id — BIGSERIAL сам
                -- бэкфиллит существующие строки при ADD COLUMN. status всё ещё
                -- просто TEXT без CHECK (см. CREATE TABLE выше) — третье
                -- значение 'in_progress' не требует миграции схемы, только
                -- правки в validation.js/server.js.
                ALTER TABLE stats_support_tickets ADD COLUMN IF NOT EXISTS ticket_number BIGSERIAL;
                CREATE UNIQUE INDEX IF NOT EXISTS stats_support_tickets_ticket_number_key
                    ON stats_support_tickets (ticket_number);
                -- Готовые ответы для админки тикетов — общий пул на всех
                -- админов (не per-user), поэтому без owner_id: это шаблоны
                -- организации, а не личные заметки конкретного сотрудника.
                CREATE TABLE IF NOT EXISTS stats_canned_responses (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )`
            )
            .catch(err => {
                // Гонка двух процессов на свежей БД (см. utils/db.js) — не
                // ошибка схемы, просто не наш вызов создал таблицы первым.
                if (err.code === '23505') return;
                schemaReady = null;
                throw err;
            });
    }
    return schemaReady;
}

module.exports = { getPool, ensureSchema };
