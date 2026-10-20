// Коды подтверждения email при регистрации — тот же паттерн, что
// security/emailCodes.js у бота (10 минут жизни, не чаще раза в минуту,
// ограничение числа попыток), но своя таблица (stats_email_codes,
// ключ — email, а не discordId) и своя БД-обвязка (см. db.js).
const { getPool, ensureSchema } = require('./db');

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function upsertCode(email, code) {
    await ensureSchema();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await getPool().query(
        `INSERT INTO stats_email_codes (email, code, attempts, expires_at, created_at)
         VALUES ($1, $2, 0, $3, now())
         ON CONFLICT (email) DO UPDATE
           SET code = EXCLUDED.code,
               attempts = 0,
               expires_at = EXCLUDED.expires_at,
               created_at = now()`,
        [email, code, expiresAt]
    );
}

async function getCode(email) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT code, attempts, expires_at, created_at FROM stats_email_codes WHERE email = $1`,
        [email]
    );
    return rows[0] ?? null;
}

async function registerFailedAttempt(email) {
    await ensureSchema();
    await getPool().query(`UPDATE stats_email_codes SET attempts = attempts + 1 WHERE email = $1`, [email]);
}

async function deleteCode(email) {
    await ensureSchema();
    await getPool().query(`DELETE FROM stats_email_codes WHERE email = $1`, [email]);
}

async function isOnCooldown(email) {
    const row = await getCode(email);
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
