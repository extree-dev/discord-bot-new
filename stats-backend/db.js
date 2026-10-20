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
