// HTTP-часть contact-bot: отдаёт Mini App (public/) и его API. Слушает
// только на внутренней docker-сети (см. docker-compose.yml) — наружу
// смотрит через Caddy (web/Caddyfile, contact.extree.tech),
// порт наружу не публикуется.
const express = require('express');
const https = require('https');
const crypto = require('crypto');
const path = require('path');

// Проверка Telegram WebApp initData — см.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// secretKey = HMAC_SHA256("WebAppData", botToken), затем HMAC_SHA256(secretKey, dataCheckString).
function verifyInitData(initData, token) {
    if (!initData) return null;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computedHash !== hash) return null;

    const authDate = Number(params.get('auth_date'));
    // Старше суток — отклоняем: initData не должен использоваться повторно
    // бесконечно долго (например, если он утёк из логов/истории браузера).
    if (!authDate || Date.now() / 1000 - authDate > 86_400) return null;

    try {
        return JSON.parse(params.get('user') || '{}');
    } catch (_err) {
        return null;
    }
}

function createWebAppServer({ bot, token, adminChatId, storage, port }) {
    const app = express();
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

    function requireAdmin(req, res, next) {
        const user = verifyInitData(req.header('X-Telegram-Init-Data'), token);
        if (!user || String(user.id) !== String(adminChatId)) {
            return res.status(401).json({ error: 'unauthorized' });
        }
        next();
    }

    app.get('/api/conversations', requireAdmin, (_req, res) => {
        res.json(storage.listConversations());
    });

    app.get('/api/conversations/:chatId', requireAdmin, (req, res) => {
        const convo = storage.getConversation(req.params.chatId);
        if (!convo) return res.status(404).json({ error: 'not_found' });
        res.json(convo);
    });

    app.post('/api/conversations/:chatId/reply', requireAdmin, async (req, res) => {
        const { chatId } = req.params;
        const text = String(req.body?.text || '').slice(0, 4000);
        if (!text) return res.status(400).json({ error: 'empty' });
        try {
            await bot.sendMessage(chatId, text);
        } catch (err) {
            return res.status(502).json({ error: 'delivery_failed', message: err.message });
        }
        storage.recordMessage(chatId, { direction: 'out', text, at: new Date().toISOString() });
        res.json({ ok: true });
    });

    app.post('/api/conversations/:chatId/block', requireAdmin, (req, res) => {
        storage.block(req.params.chatId);
        res.json({ ok: true });
    });

    app.post('/api/conversations/:chatId/unblock', requireAdmin, (req, res) => {
        storage.unblock(req.params.chatId);
        res.json({ ok: true });
    });

    return app.listen(port, () => console.log(`contact-bot: Mini App API слушает на :${port}`));
}

// setChatMenuButton для конкретного chat_id (не глобально) — кнопку
// "Mini App" видит только владелец, а не любой, кто напишет боту.
// Напрямую через HTTPS, а не через node-telegram-bot-api — метод не во
// всех версиях обёрнут, а сырой запрос не зависит от версии библиотеки.
function setAdminMenuButton({ token, adminChatId, url }) {
    const payload = JSON.stringify({
        chat_id: Number(adminChatId),
        menu_button: { type: 'web_app', text: '📋 Панель', web_app: { url } },
    });
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: 'api.telegram.org',
                path: `/bot${token}/setChatMenuButton`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
            },
            res => {
                let body = '';
                res.on('data', chunk => (body += chunk));
                res.on('end', () => {
                    if (res.statusCode === 200) resolve(JSON.parse(body));
                    else reject(new Error(`setChatMenuButton: HTTP ${res.statusCode} ${body}`));
                });
            }
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

module.exports = { createWebAppServer, setAdminMenuButton, verifyInitData };
