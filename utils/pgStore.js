const { getPool, ensureSchema } = require('./db');

// Postgres-версия utils/jsonStore.js: тот же принцип (один JSON-документ
// на "стор", атомарный read-modify-write через update()), но данные
// лежат в таблице bot_stores, а не в файле на диске. Блокировка теперь
// обеспечивается транзакцией с SELECT ... FOR UPDATE на уровне БД —
// в отличие от файловой очереди jsonStore.js, это защищает от гонок
// даже если бот когда-нибудь будет запущен несколькими процессами
// (несколько инстансов бота, воркер для команд отдельно от основного
// процесса и т.п.), а не только от гонок внутри одного event loop.

/**
 * Создаёт обёртку над одной строкой таблицы bot_stores.
 *
 * @param {string} name - уникальное имя стора (ключ в bot_stores).
 * @param {object} defaults - значения по умолчанию для новой строки.
 * @param {(raw: object) => object} normalize - объединяет прочитанные
 *   данные с defaults (глубоко, если есть вложенные объекты) — тот же
 *   контракт, что и в jsonStore.createStore().
 */
function createStore(name, defaults, normalize = data => ({ ...defaults, ...data })) {
    async function ensureRow(queryable) {
        await queryable.query('INSERT INTO bot_stores (name, data) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING', [
            name,
            JSON.stringify(defaults),
        ]);
    }

    async function load() {
        await ensureSchema();
        const pool = getPool();
        await ensureRow(pool);
        const { rows } = await pool.query('SELECT data FROM bot_stores WHERE name = $1', [name]);
        return normalize(rows[0]?.data ?? {});
    }

    // Оставлен для мест, где load()+save() выполняются без await между
    // ними (тогда логической гонки нет, а перечитывать данные внутри
    // транзакции избыточно). Если нужна защита от гонки — используйте update().
    async function save(config) {
        await ensureSchema();
        await getPool().query(
            `INSERT INTO bot_stores (name, data) VALUES ($1, $2)
             ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data`,
            [name, JSON.stringify(config)]
        );
    }

    /**
     * Безопасный read-modify-write: SELECT ... FOR UPDATE держит
     * блокировку строки на время транзакции, поэтому конкурентные
     * update()/save() над одним стором не могут перекрыть друг друга —
     * второй вызов просто ждёт коммита первого перед своим SELECT.
     *
     * mutate(config) может мутировать объект напрямую и/или вернуть
     * значение — это значение становится результатом update().
     */
    async function update(mutate) {
        await ensureSchema();
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            await ensureRow(client);
            const { rows } = await client.query('SELECT data FROM bot_stores WHERE name = $1 FOR UPDATE', [name]);
            const config = normalize(rows[0]?.data ?? {});
            const result = await mutate(config);
            await client.query('UPDATE bot_stores SET data = $2 WHERE name = $1', [name, JSON.stringify(config)]);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }

    return { load, save, update, name };
}

module.exports = { createStore };
