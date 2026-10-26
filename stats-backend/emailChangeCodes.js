// Коды подтверждения смены email в настройках аккаунта — тот же паттерн,
// что emailCodes.js (10 минут жизни, не чаще раза в минуту, ограничение
// числа попыток), но ключ — user_id, а не email: пользователь уже
// залогинен, меняет СВОЙ email на новый, и одновременно может быть только
// одна ожидающая подтверждения смена (ON CONFLICT (user_id) перезаписывает
// предыдущую попытку, как и upsertCode у emailCodes.js).
const { getPool, ensureSchema } = require('./db');

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function upsertCode(userId, newEmail, code) {
    await ensureSchema();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await getPool().query(
        `INSERT INTO stats_email_change_codes (user_id, new_email, code, attempts, expires_at, created_at)
         VALUES ($1, $2, $3, 0, $4, now())
         ON CONFLICT (user_id) DO UPDATE
           SET new_email = EXCLUDED.new_email,
               code = EXCLUDED.code,
               attempts = 0,
               expires_at = EXCLUDED.expires_at,
               created_at = now()`,
        [userId, newEmail, code, expiresAt]
    );
}

async function getCode(userId) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT new_email, code, attempts, expires_at, created_at FROM stats_email_change_codes WHERE user_id = $1`,
        [userId]
    );
    return rows[0] ?? null;
}

async function registerFailedAttempt(userId) {
    await ensureSchema();
    await getPool().query(`UPDATE stats_email_change_codes SET attempts = attempts + 1 WHERE user_id = $1`, [userId]);
}

async function deleteCode(userId) {
    await ensureSchema();
    await getPool().query(`DELETE FROM stats_email_change_codes WHERE user_id = $1`, [userId]);
}

async function isOnCooldown(userId) {
    const row = await getCode(userId);
    if (!row) return false;
    return Date.now() - new Date(row.created_at).getTime() < RESEND_COOLDOWN_MS;
}

module.exports = {
    generateCode,
    upsertCode,
    getCode,
    registerFailedAttempt,
    deleteCode,
    isOnCooldown,
    CODE_TTL_MS,
    RESEND_COOLDOWN_MS,
    MAX_ATTEMPTS,
};
