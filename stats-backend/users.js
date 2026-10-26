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
        `SELECT id, email, password_hash, email_verified_at, riot_puuid, name, nickname FROM stats_users WHERE email = $1`,
        [email]
    );
    return rows[0] ?? null;
}

// password_hash включён в выборку (хотя большинству вызывающих он не
// нужен) ради /auth/account/change-email и /auth/account/change-password
// — обоим нужно сверить текущий пароль по id из сессии, не по email.
// Безопасно: ни один вызывающий код не отдаёт объект user целиком наружу,
// всегда явно перечисляет нужные поля в ответе (см. /api/account/me).
async function findById(id) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT id, email, password_hash, email_verified_at, riot_puuid, name, nickname FROM stats_users WHERE id = $1`,
        [id]
    );
    return rows[0] ?? null;
}

// Используется и для первой регистрации, и для повторной попытки тем же
// email, пока он ещё не подтверждён (см. /auth/register) — ON CONFLICT
// перезаписывает пароль/имя/никнейм на случай, если в первый раз их
// ввели с опечаткой. Конфликт по UNIQUE(nickname) (кто-то другой уже
// занял этот никнейм) всплывает наверх как есть — вызывающий код
// (server.js) различает его по err.constraint и отвечает nickname_taken.
async function upsertUnverifiedUser(email, passwordHash, { name, nickname }) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `INSERT INTO stats_users (id, email, password_hash, name, nickname)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               name = EXCLUDED.name,
               nickname = EXCLUDED.nickname
         RETURNING id, email, email_verified_at`,
        [crypto.randomUUID(), email, passwordHash, name, nickname]
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

// Сброс пароля (см. passwordResets.js) — отдельная функция, а не переиспользование
// upsertUnverifiedUser: тот рассчитан на ещё не подтверждённый аккаунт и
// трогает nickname/name, этот — только хеш пароля уже существующего.
async function updatePasswordHash(userId, passwordHash) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `UPDATE stats_users SET password_hash = $2 WHERE id = $1 RETURNING id, email`,
        [userId, passwordHash]
    );
    return rows[0] ?? null;
}

// Смена email в настройках аккаунта (не путать с markEmailVerified —
// та подтверждает ПЕРВИЧНЫЙ email при регистрации). Новый адрес уже
// подтверждён кодом на момент вызова (см. /auth/account/confirm-email-change),
// поэтому email_verified_at сразу проставляется — семантика "подтверждён"
// не должна сбрасываться в процессе смены.
async function updateEmail(userId, newEmail) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `UPDATE stats_users SET email = $2, email_verified_at = now() WHERE id = $1 RETURNING id, email`,
        [userId, newEmail]
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
    updatePasswordHash,
    updateEmail,
};
