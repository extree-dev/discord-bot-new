// Хранение аккаунтов Extree Stats (email + пароль). Пароль хешируется
// crypto.scryptSync — тот же приём, что dashboard/accounts.js (без
// внешней зависимости вроде bcrypt, которая на Alpine требует
// компиляции нативного модуля при сборке образа).
const crypto = require('crypto');
const { getPool, ensureSchema } = require('./db');

const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPasswordHash(password, stored) {
    if (!stored) return false;
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

async function findByEmail(email) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT id, email, password_hash, email_verified_at, riot_puuid FROM stats_users WHERE email = $1`,
        [email]
    );
    return rows[0] ?? null;
}

async function findById(id) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT id, email, email_verified_at, riot_puuid FROM stats_users WHERE id = $1`,
        [id]
    );
    return rows[0] ?? null;
}

// Используется и для первой регистрации, и для повторной попытки тем же
// email, пока он ещё не подтверждён (см. /auth/register) — ON CONFLICT
// перезаписывает пароль на случай, если в первый раз его ввели с опечаткой.
async function upsertUnverifiedUser(email, passwordHash) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `INSERT INTO stats_users (id, email, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id, email, email_verified_at`,
        [crypto.randomUUID(), email, passwordHash]
    );
    return rows[0];
}

async function markEmailVerified(email) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `UPDATE stats_users SET email_verified_at = now() WHERE email = $1 RETURNING id, email, email_verified_at`,
        [email]
    );
    return rows[0] ?? null;
}

module.exports = {
    hashPassword,
    verifyPasswordHash,
    findByEmail,
    findById,
    upsertUnverifiedUser,
    markEmailVerified,
};
