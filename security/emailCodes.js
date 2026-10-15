const { getPool, ensureSchema } = require('../utils/db');

const CODE_TTL_MS = 10 * 60 * 1000; // код живёт 10 минут
const RESEND_COOLDOWN_MS = 60 * 1000; // не чаще 1 письма в минуту

async function upsertCode(discordId, email, code) {
    await ensureSchema();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    await getPool().query(
        `INSERT INTO email_codes (discord_id, email, code, expires_at, created_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (discord_id) DO UPDATE
           SET email = EXCLUDED.email,
               code = EXCLUDED.code,
               expires_at = EXCLUDED.expires_at,
               created_at = now()`,
        [discordId, email, code, expiresAt]
    );
}

async function getCode(discordId) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT email, code, expires_at, created_at FROM email_codes WHERE discord_id = $1`,
        [discordId]
    );
    return rows[0] ?? null;
}

async function deleteCode(discordId) {
    await ensureSchema();
    await getPool().query(`DELETE FROM email_codes WHERE discord_id = $1`, [discordId]);
}

async function isOnCooldown(discordId) {
    const row = await getCode(discordId);
    if (!row) return false;
    return Date.now() - new Date(row.created_at).getTime() < RESEND_COOLDOWN_MS;
}

module.exports = { upsertCode, getCode, deleteCode, isOnCooldown, CODE_TTL_MS, RESEND_COOLDOWN_MS };
