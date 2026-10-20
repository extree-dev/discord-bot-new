// "Известные" места входа — по стране, не по точному IP: у обычных
// домашних провайдеров IP меняется при каждом переподключении роутера, а
// у мобильного интернета — почти при каждой сессии. Требовать точного
// совпадения IP означало бы блокировать владельца аккаунта почти всегда.
// Город из geoip-lite хранится только для текста уведомлений — его
// точность у офлайн-баз ниже, чем у страны, поэтому в сравнение он не
// входит (см. обсуждение при проектировании).
const { getPool, ensureSchema } = require('./db');

async function hasAnyKnownLocation(userId) {
    await ensureSchema();
    const { rows } = await getPool().query(`SELECT 1 FROM stats_known_locations WHERE user_id = $1 LIMIT 1`, [
        userId,
    ]);
    return rows.length > 0;
}

// country === null значит, что IP не удалось геолоцировать (локальный
// адрес, пробел в офлайн-базе и т.п.) — в этом случае НЕ блокируем:
// лучше пропустить вход, для которого нет данных, чем ошибочно запереть
// владельца аккаунта из-за пробела в базе геолокации.
async function isKnownLocation(userId, country) {
    if (!country) return true;
    await ensureSchema();
    const { rows } = await getPool().query(
        `SELECT 1 FROM stats_known_locations WHERE user_id = $1 AND country = $2 LIMIT 1`,
        [userId, country]
    );
    return rows.length > 0;
}

async function rememberLocation(userId, country, city, ip) {
    if (!country) return;
    await ensureSchema();
    await getPool().query(
        `INSERT INTO stats_known_locations (user_id, country, city, last_ip, created_at, last_seen_at)
         VALUES ($1, $2, $3, $4, now(), now())
         ON CONFLICT (user_id, country) DO UPDATE
           SET city = EXCLUDED.city,
               last_ip = EXCLUDED.last_ip,
               last_seen_at = now()`,
        [userId, country, city, ip]
    );
}

module.exports = { hasAnyKnownLocation, isKnownLocation, rememberLocation };
