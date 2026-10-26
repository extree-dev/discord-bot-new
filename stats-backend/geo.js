// Приблизительная геолокация по IP — полностью офлайн (geoip-lite несёт
// собственную таблицу диапазонов внутри пакета), ни один внешний сервис
// не вызывается и сам IP никуда не уходит за пределы нашего сервера. Это
// важно и для приватности (см. Privacy Policy), и для надёжности — не
// хотим, чтобы вход зависел от доступности стороннего геолокационного API.
const net = require('net');
const geoip = require('geoip-lite');

function getClientIp(req) {
    // app.set('trust proxy', 1) в server.js — req.ip уже учитывает
    // X-Forwarded-For от ближайшего доверенного прокси.
    return req.ip;
}

function lookupLocation(ip) {
    // net.isIP отсекает всё, что не является валидным IPv4/IPv6 до того,
    // как строка попадёт в geoip-lite/ip-address — осознанная защита от
    // DoS на разборе переданного значения (см. GHSA-h3mg-xc3c-68pw), а не
    // просто проверка формата.
    if (!ip || net.isIP(ip) === 0) return { country: null, city: null };

    const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    const result = geoip.lookup(normalized);
    if (!result) return { country: null, city: null };

    return { country: result.country || null, city: result.city || null };
}

module.exports = { getClientIp, lookupLocation };
