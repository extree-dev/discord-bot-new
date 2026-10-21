// Готовые ответы ("macros") для админки тикетов — общий пул шаблонов,
// вставляются в поле ответа (см. pages/admin-ticket), сама отправка всё
// равно требует отдельного нажатия "Send reply" — шаблон не отправляется
// автоматически, это только подстановка текста, которую можно поправить.
const crypto = require('crypto');
const { getPool, ensureSchema } = require('./db');

async function listCannedResponses() {
    await ensureSchema();
    const { rows } = await getPool().query(`SELECT id, title, body FROM stats_canned_responses ORDER BY title ASC`);
    return rows;
}

async function createCannedResponse(title, body) {
    await ensureSchema();
    const id = crypto.randomUUID();
    await getPool().query(`INSERT INTO stats_canned_responses (id, title, body) VALUES ($1, $2, $3)`, [
        id,
        title,
        body,
    ]);
    return { id };
}

async function deleteCannedResponse(id) {
    await ensureSchema();
    await getPool().query(`DELETE FROM stats_canned_responses WHERE id = $1`, [id]);
}

module.exports = { listCannedResponses, createCannedResponse, deleteCannedResponse };
