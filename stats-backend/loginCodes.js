// Коды подтверждения входа с нового места — тот же паттерн, что
// emailCodes.js (10 минут жизни, не чаще раза в минуту, ограничение
// попыток), но своя таблица (stats_login_codes) и своя цель: не
// подтвердить владение email при регистрации, а подтвердить, что вход из
// незнакомой страны — от владельца аккаунта. Заодно хранит ip/country/city
// того самого входа, который подтверждаем — доверяем месту из исходной
// попытки, а не месту, откуда в итоге ввели код.
const { getPool, ensureSchema } = require('./db');

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function upsertCode(email, code, { ip, country, city, remember = true }) {
    await ensureSchema();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await getPool().query(
        `INSERT INTO stats_login_codes (email, code, attempts, ip, country, city, remember, expires_at, created_at)
         VALUES ($1, $2, 0, $3, $4, $5, $6, $7, now())
         ON CONFLICT (email) DO UPDATE
           SET code = EXCLUDED.code,
               attempts = 0,
               ip = EXCLUDED.ip,
               country = EXCLUDED.country,
               city = EXCLUDED.city,
               remember = EXCLUDED.remember,
               expires_at = EXCLUDED.expires_at,
               created_at = now()`,
        [email, code, ip ?? null, country ?? null, city ?? null, remember, expiresAt]
    );
}

async function getCode(email) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT code, attempts, ip, country, city, remember, expires_at, created_at FROM stats_login_codes WHERE email = $1`,
        [email]
    );
    return rows[0] ?? null;
}

async function registerFailedAttempt(email) {
    await ensureSchema();
    await getPool().query(`UPDATE stats_login_codes SET attempts = attempts + 1 WHERE email = $1`, [email]);
}

async function deleteCode(email) {
    await ensureSchema();
    await getPool().query(`DELETE FROM stats_login_codes WHERE email = $1`, [email]);
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
