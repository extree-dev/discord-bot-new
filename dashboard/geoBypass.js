const crypto = require('crypto');

// Вынесено отдельно от server.js ради юнит-теста: сравнение секрета без
// поднятия всего Express-приложения (требует DISCORD_TOKEN и т.п.).
function isValidGeoBypassToken(given, configured) {
    if (!configured || typeof given !== 'string') {
        return false;
    }
    const bufGiven = Buffer.from(given);
    const bufConfigured = Buffer.from(configured);
    if (bufGiven.length !== bufConfigured.length) {
        // timingSafeEqual требует одинаковую длину буферов — длина токена
        // не секрет, так что это не утечка тайминга самого значения.
        return false;
    }
    return crypto.timingSafeEqual(bufGiven, bufConfigured);
}

module.exports = { isValidGeoBypassToken };
