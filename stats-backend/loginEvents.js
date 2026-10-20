// Журнал входов для "Recent sign-ins" в настройках аккаунта — в отличие
// от stats_known_locations (агрегат "эта страна нам знакома", одна строка
// на страну, перезаписывается при каждом визите), это полноценный лог:
// отдельная строка на каждый реальный вход, с меткой времени.
//
// Пишется там же, где уже стоит sendSignInNotification/sendPasswordChanged
// (см. server.js) — т.е. только на настоящие "входы" (/auth/login,
// /auth/login/confirm-location, /auth/reset-password), не на сессию,
// которую /auth/verify ставит сразу после регистрации — та же граница,
// что уже проведена для email-уведомлений о входе.
const crypto = require('crypto');
const { getPool, ensureSchema } = require('./db');

const MAX_EVENTS_PER_USER = 20;
const LIST_LIMIT = 10;

async function recordLogin(userId, { ip, country, city }) {
    await ensureSchema();
    const pool = getPool();
    await pool.query(`INSERT INTO stats_login_events (id, user_id, ip, country, city) VALUES ($1, $2, $3, $4, $5)`, [
        crypto.randomUUID(),
        userId,
        ip ?? null,
        country ?? null,
        city ?? null,
    ]);
    // Храним ограниченную историю на аккаунт — это журнал для отображения
    // пользователю, не аудит-лог на годы вперёд, незачем расти бесконечно.
    await pool.query(
        `DELETE FROM stats_login_events
         WHERE user_id = $1
           AND id NOT IN (
               SELECT id FROM stats_login_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2
           )`,
        [userId, MAX_EVENTS_PER_USER]
    );
}

async function listRecent(userId, limit = LIST_LIMIT) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT id, ip, country, city, created_at FROM stats_login_events
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [userId, limit]
    );
    return rows;
}

module.exports = { recordLogin, listRecent };
