// Заявки в поддержку — доступны и без входа (см. обсуждение в PR: человек,
// у которого не получается войти, это ровно тот, кому часто и нужна
// поддержка), поэтому user_id необязателен. id — UUID, сгенерированный на
// нашей стороне (crypto.randomUUID(), тот же приём, что users.js для
// stats_users.id), а не DEFAULT в схеме — единообразно со всей остальной
// схемой этого проекта.
const crypto = require('crypto');
const { getPool, ensureSchema } = require('./db');

const RESEND_COOLDOWN_MS = 60 * 1000;

// Защита от спама формой — тот же порог в минуту, что у остальных
// email-триггеров этого продукта (emailCodes/loginCodes/passwordResets),
// просто по последнему тикету с этого email, а не по отдельной таблице
// кодов — тут не код, который перезаписывается, а история обращений,
// которую стоит хранить целиком.
async function isOnCooldown(email) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT created_at FROM stats_support_tickets WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
        [email]
    );
    if (!rows[0]) return false;
    return Date.now() - new Date(rows[0].created_at).getTime() < RESEND_COOLDOWN_MS;
}

async function createTicket({ userId, email, subject, message }) {
    await ensureSchema();
    const id = crypto.randomUUID();
    await getPool().query(
        `INSERT INTO stats_support_tickets (id, user_id, email, subject, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, userId ?? null, email, subject, message]
    );
    return { id };
}

module.exports = { createTicket, isOnCooldown };
