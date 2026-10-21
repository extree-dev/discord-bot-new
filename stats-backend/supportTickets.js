// Заявки в поддержку — доступны и без входа (см. обсуждение в PR: человек,
// у которого не получается войти, это ровно тот, кому часто и нужна
// поддержка), поэтому user_id необязателен. id — UUID, сгенерированный на
// нашей стороне (crypto.randomUUID(), тот же приём, что users.js для
// stats_users.id), а не DEFAULT в схеме — единообразно со всей остальной
// схемой этого проекта.
//
// view_token — отдельный секрет для просмотра/ответа на тикет без входа
// (ссылка в письме-подтверждении): raw UUID тикета не годится для этого —
// он уже известен админке по id в адресной строке /admin/tickets/:id,
// если бы это был один и тот же идентификатор, из URL админки можно было
// бы угадать ссылку просмотра чужого тикета.
const crypto = require('crypto');
const { getPool, ensureSchema } = require('./db');

const RESEND_COOLDOWN_MS = 60 * 1000;

function generateViewToken() {
    return crypto.randomBytes(24).toString('hex');
}

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

// Тот же кулдаун, что на создание тикета, но по последнему ответу автора
// "user" в этом конкретном тикете — не даёт заспамить ответами один тред.
async function isReplyOnCooldown(ticketId) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT created_at FROM stats_support_ticket_replies
         WHERE ticket_id = $1 AND author = 'user' ORDER BY created_at DESC LIMIT 1`,
        [ticketId]
    );
    if (!rows[0]) return false;
    return Date.now() - new Date(rows[0].created_at).getTime() < RESEND_COOLDOWN_MS;
}

async function createTicket({ userId, email, subject, message, category }) {
    await ensureSchema();
    const id = crypto.randomUUID();
    const viewToken = generateViewToken();
    await getPool().query(
        `INSERT INTO stats_support_tickets (id, user_id, email, subject, message, category, view_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, userId ?? null, email, subject, message, category, viewToken]
    );
    return { id, viewToken };
}

// Для админки — без текста сообщения (не нужен в списке, подтягивается
// отдельным запросом в детали тикета).
async function listTickets({ status } = {}) {
    await ensureSchema();
    const pool = getPool();
    const { rows } = status
        ? await pool.query(
              `SELECT id, email, subject, category, status, created_at FROM stats_support_tickets
               WHERE status = $1 ORDER BY created_at DESC LIMIT 200`,
              [status]
          )
        : await pool.query(
              `SELECT id, email, subject, category, status, created_at FROM stats_support_tickets
               ORDER BY created_at DESC LIMIT 200`
          );
    return rows;
}

async function getTicketById(id) {
    await ensureSchema();
    const { rows } = await getPool().query(`SELECT * FROM stats_support_tickets WHERE id = $1`, [id]);
    return rows[0] ?? null;
}

async function getTicketByToken(viewToken) {
    await ensureSchema();
    const { rows } = await getPool().query(`SELECT * FROM stats_support_tickets WHERE view_token = $1`, [viewToken]);
    return rows[0] ?? null;
}

async function listReplies(ticketId) {
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT id, author, message, created_at FROM stats_support_ticket_replies
         WHERE ticket_id = $1 ORDER BY created_at ASC`,
        [ticketId]
    );
    return rows;
}

async function addReply(ticketId, author, message) {
    await ensureSchema();
    const id = crypto.randomUUID();
    await getPool().query(
        `INSERT INTO stats_support_ticket_replies (id, ticket_id, author, message) VALUES ($1, $2, $3, $4)`,
        [id, ticketId, author, message]
    );
    return { id };
}

async function setStatus(ticketId, status) {
    await ensureSchema();
    await getPool().query(`UPDATE stats_support_tickets SET status = $1 WHERE id = $2`, [status, ticketId]);
}

module.exports = {
    createTicket,
    isOnCooldown,
    isReplyOnCooldown,
    listTickets,
    getTicketById,
    getTicketByToken,
    listReplies,
    addReply,
    setStatus,
};
