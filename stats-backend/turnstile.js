// Cloudflare Turnstile — проверка токена с виджета на /login через
// siteverify API. Secret key только здесь, на бэкенде (TURNSTILE_SECRET_KEY
// в .env); Site key — публичный, безопасно встроен прямо в код фронтенда
// (stats-frontend/src/shared/config.ts), как и положено Site Key у любой
// капчи — в отличие от Secret Key он не секрет.
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Встроенный fetch Node 18+ — лишняя зависимость не нужна (тот же
// принцип, что и у остального stats-backend: pg/nodemailer/geoip-lite
// добавлены только там, где без них никак).
async function verifyTurnstileToken(token, remoteIp) {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
        // Нет ключа — значит Turnstile ещё не настроен в этом окружении.
        // Отказываем в проверке (fail closed), а не пропускаем молча: это
        // защита от ботов на /login, тихо пропускать её при пустом
        // конфиге было бы хуже, чем честно сообщить об ошибке.
        console.error('stats-backend: TURNSTILE_SECRET_KEY не задан — проверка Turnstile невозможна.');
        return false;
    }
    if (typeof token !== 'string' || !token) return false;

    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.append('remoteip', remoteIp);

    try {
        const res = await fetch(VERIFY_URL, { method: 'POST', body });
        const data = await res.json();
        return data.success === true;
    } catch (err) {
        console.error('stats-backend: ошибка обращения к Cloudflare Turnstile siteverify:', err);
        return false;
    }
}

module.exports = { verifyTurnstileToken };
