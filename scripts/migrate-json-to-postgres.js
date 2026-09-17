// Одноразовый перенос существующих data/*.json (security-config.json,
// tickets.json, temp-voice.json, warnings.json) в PostgreSQL — для тех,
// кто уже гонял бота на файловом хранилище и переходит на БД.
// Запуск: npm run db:migrate-json (нужен настроенный DATABASE_URL в .env).
//
// Безопасно запускать повторно: если строка для стора уже существует в
// bot_stores, она перезаписывается данными из файла (а не дублируется).
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { getPool, ensureSchema, closePool } = require('../utils/db');

const FILES = [
    { file: 'security-config.json', store: 'security-config' },
    { file: 'tickets.json', store: 'tickets' },
    { file: 'temp-voice.json', store: 'temp-voice' },
    { file: 'warnings.json', store: 'warnings' },
];

async function migrateFile({ file, store }) {
    const filePath = path.join(__dirname, '..', 'data', file);
    if (!fs.existsSync(filePath)) {
        console.log(`Пропущено (файла нет): ${file}`);
        return;
    }

    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) {
        console.log(`Пропущено (файл пустой): ${file}`);
        return;
    }

    const data = JSON.parse(raw);
    await getPool().query(
        `INSERT INTO bot_stores (name, data) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data`,
        [store, JSON.stringify(data)]
    );
    console.log(`Перенесено в БД: ${file} -> bot_stores['${store}']`);
}

(async () => {
    try {
        await ensureSchema();
        for (const entry of FILES) {
            await migrateFile(entry);
        }
        console.log('Готово. Проверь данные и, если всё в порядке, можешь убрать каталог data/.');
    } catch (err) {
        console.error('Ошибка миграции:', err);
        process.exitCode = 1;
    } finally {
        await closePool();
    }
})();
