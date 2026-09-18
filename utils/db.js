const { Pool } = require('pg');

let pool = null;
let schemaReady = null;

// Единый пул соединений на процесс. connectionString берётся из
// DATABASE_URL (см. .env.example) — так же, как discord.js берёт токен
// из DISCORD_TOKEN.
function getPool() {
    if (!pool) {
        pool = new Pool({ connectionString: process.env.DATABASE_URL });
        // Без этого обработчика ошибка на простаивающем в пуле соединении
        // (например, БД перезапустилась) уронит процесс необработанным
        // исключением — pg сам не логирует такие ошибки.
        pool.on('error', err => {
            console.error('Postgres: ошибка простаивающего соединения в пуле:', err.message);
        });
    }
    return pool;
}

// CREATE TABLE IF NOT EXISTS безопасно выполнять сколько угодно раз;
// кэшируем промис, чтобы не слать этот запрос перед каждым load/save/update.
function ensureSchema() {
    if (!schemaReady) {
        schemaReady = getPool()
            .query(
                `CREATE TABLE IF NOT EXISTS bot_stores (
                    name TEXT PRIMARY KEY,
                    data JSONB NOT NULL
                )`
            )
            .catch(err => {
                // CREATE TABLE IF NOT EXISTS не атомарен между сессиями:
                // если два процесса одновременно решат, что таблицы ещё
                // нет (например, тесты — каждый файл в своём процессе,
                // все стартуют почти одновременно на свежей БД), оба
                // попытаются создать её системный тип строки и один
                // получит 23505 (duplicate key на pg_type/pg_class), хотя
                // таблица в итоге успешно создана вторым процессом. Это
                // не ошибка схемы — просто не наш вызов выиграл гонку.
                if (err.code === '23505') return;
                schemaReady = null; // дать шанс повторить попытку при следующем вызове
                throw err;
            });
    }
    return schemaReady;
}

// Используется в тестах/скриптах, которым нужно корректно завершиться
// (иначе открытый пул соединений держит процесс живым).
async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
        schemaReady = null;
    }
}

module.exports = { getPool, ensureSchema, closePool };
