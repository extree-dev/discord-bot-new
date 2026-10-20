// Токены сброса пароля — в отличие от emailCodes.js/loginCodes.js (6
// цифр, которые человек печатает руками), это ссылка: пользователь по
// ней кликает, а не вводит значение, поэтому не нужно ограничивать
// длину/алфавит под удобство набора — 32 случайных байта в hex дают
// достаточно энтропии, чтобы токен нельзя было подобрать переборм, и не
// нужен счётчик попыток, как у 6-значных кодов.
const crypto = require('crypto');
const { getPool, ensureSchema } = require('./db');

const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Новый запрос сброса инвалидирует предыдущие ссылки для этого аккаунта —
// иначе после пары повторных запросов в почте накапливались бы несколько
// одновременно рабочих ссылок на сброс пароля.
async function createReset(userId, email) {
    await ensureSchema();
    const pool = getPool();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await pool.query(`DELETE FROM stats_password_resets WHERE user_id = $1`, [userId]);
    await pool.query(
        `INSERT INTO stats_password_resets (token, user_id, email, expires_at, created_at)
         VALUES ($1, $2, $3, $4, now())`,
        [token, userId, email, expiresAt]
    );
    return token;
}

async function getReset(token) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT token, user_id, email, expires_at, created_at FROM stats_password_resets WHERE token = $1`,
        [token]
    );
    return rows[0] ?? null;
}

async function deleteReset(token) {
    await ensureSchema();
    await getPool().query(`DELETE FROM stats_password_resets WHERE token = $1`, [token]);
}

// Та же антиспам-логика, что emailCodes.isOnCooldown/loginCodes.isOnCooldown,
// но по email, а не по токену — на момент запроса нового сброса токена
// ещё не существует.
async function isOnCooldown(email) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT created_at FROM stats_password_resets WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
        [email]
    );
    if (!rows[0]) return false;
    return Date.now() - new Date(rows[0].created_at).getTime() < RESEND_COOLDOWN_MS;
}

module.exports = { createReset, getReset, deleteReset, isOnCooldown, TOKEN_TTL_MS, RESEND_COOLDOWN_MS };
