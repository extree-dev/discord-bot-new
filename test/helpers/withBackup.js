const { getPool, ensureSchema } = require('../../utils/db');

// Тесты для config/warnings-модулей пишут в те же строки bot_stores,
// которыми пользуется реальный бот (имя стора зашито в исходниках,
// подменить его без правки модулей нельзя). withStoreBackup() сохраняет
// текущее содержимое строки перед тестом и восстанавливает его после
// (или удаляет строку, если её не было), даже если тест упал —
// на CI-базе данных нет ничего, но на локальной БД разработчика могут
// быть настоящие настройки сервера.
async function withStoreBackup(storeName, fn) {
    await ensureSchema();
    const pool = getPool();

    const { rows } = await pool.query('SELECT data FROM bot_stores WHERE name = $1', [storeName]);
    const existed = rows.length > 0;
    const original = existed ? rows[0].data : null;

    try {
        await fn();
    } finally {
        if (existed) {
            await pool.query('UPDATE bot_stores SET data = $2 WHERE name = $1', [storeName, JSON.stringify(original)]);
        } else {
            await pool.query('DELETE FROM bot_stores WHERE name = $1', [storeName]);
        }
    }
}

module.exports = { withStoreBackup };
