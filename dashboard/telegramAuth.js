// Проверка данных от Telegram Login Widget (https://core.telegram.org/widgets/login).
// Виджет редиректит на наш auth-url с query-параметрами (id, first_name,
// username, photo_url, auth_date, hash) — hash нужно проверить самим,
// иначе кто угодно мог бы подставить чужой Telegram id в запросе.
//
// Алгоритм из документации Telegram: secret_key = SHA256(bot_token),
// data_check_string — все поля кроме hash, отсортированные по ключу,
// в виде "key=value" через \n, затем HMAC-SHA256(data_check_string, secret_key)
// должен совпасть с hash.
const crypto = require('crypto');

// Виджет живёт в браузере пользователя — не ограничено по времени
// жёстко протоколом, но считать авторизацию вечной небезопасно (украденная
// ссылка с валidным hash работала бы бесконечно). Сутки — тот же порядок,
// что у Discord-сессии (SESSION_MAX_AGE_MS = 7 дней, но здесь именно
// момент редиректа, а не вся сессия).
const MAX_AUTH_AGE_MS = 24 * 60 * 60 * 1000;

function verifyTelegramAuth(data, botToken) {
    if (!data || !data.hash || !data.id || !data.auth_date) return false;

    const { hash, ...fields } = data;
    const dataCheckString = Object.keys(fields)
        .sort()
        .map(key => `${key}=${fields[key]}`)
        .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(String(hash), 'hex');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return false;

    const authDateMs = Number(data.auth_date) * 1000;
    if (!Number.isFinite(authDateMs) || Date.now() - authDateMs > MAX_AUTH_AGE_MS) return false;

    return true;
}

module.exports = { verifyTelegramAuth, MAX_AUTH_AGE_MS };
