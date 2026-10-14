// Загруженные через /admin картинки (сейчас — логотипы клиентов на
// визитке) — хранятся прямо в Postgres (та же БД, что bot_stores), а не
// на диске и не во внешнем S3: один файл редко весит больше пары сотен
// КБ, их немного (MAX_CLIENTS в site/model.js = 12), и так не нужно ни
// настраивать отдельное хранилище, ни переживать за его бэкап —
// он идёт вместе с остальной БД.
//
// Отдаются обратно через GET /api/uploads/:id (dashboard/server.js) —
// тот же origin, что и сама визитка, поэтому картинки проходят через
// img-src 'self' в CSP без доп. настройки (в отличие от произвольных
// внешних ссылок, которые CSP как раз и блокирует).
const { getPool, ensureSchema } = require('../utils/db');

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);
const MAX_BYTES = 3 * 1024 * 1024;

async function save({ id, mimeType, data }) {
    await ensureSchema();
    await getPool().query('INSERT INTO site_uploads (id, mime_type, data) VALUES ($1, $2, $3)', [id, mimeType, data]);
}

async function load(id) {
    await ensureSchema();
    const { rows } = await getPool().query('SELECT mime_type, data FROM site_uploads WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return { mimeType: rows[0].mime_type, data: rows[0].data };
}

module.exports = { save, load, ALLOWED_MIME_TYPES, MAX_BYTES };
