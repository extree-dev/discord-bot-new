// Личный кабинет (bot.extree.tech/dashboard) — вход через Discord OAuth2,
// версия "только просмотр": список серверов, где у вошедшего есть права
// администратора и уже добавлен бот. Без БД — сессия целиком в
// зашифрованной cookie (dashboard/session.js). Домены/Google/Apple не
// подключены осознанно: кабинет управляет Discord-серверами, узнать это
// можно только через Discord-логин, другие провайдеры здесь просто не
// отвечают на вопрос "на каких серверах я админ".
//
// Запускается отдельным процессом в том же образе, что и сам бот (см.
// docker-compose.yml, сервис dashboard — тот же Dockerfile, другая
// command) и проксируется Caddy только по путям /auth/* и /dashboard*
// (web/Caddyfile) — всё остальное на bot.extree.tech остаётся статикой.
require('dotenv').config({ quiet: true });
const express = require('express');
const crypto = require('crypto');
const oauth = require('./discordOAuth');
const { encryptSession, decryptSession } = require('./session');
const { renderLogin, renderError, renderDashboard } = require('./views');

const PORT = process.env.DASHBOARD_PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const BOT_TOKEN = process.env.DISCORD_TOKEN;

for (const [name, value] of Object.entries({
    CLIENT_ID,
    DISCORD_CLIENT_SECRET: CLIENT_SECRET,
    DISCORD_REDIRECT_URI: REDIRECT_URI,
    SESSION_SECRET,
    DISCORD_TOKEN: BOT_TOKEN,
})) {
    if (!value) {
        console.error(`dashboard: переменная окружения ${name} не задана — дашборд не может стартовать.`);
        process.exit(1);
    }
}

const SESSION_COOKIE = 'extree_session';
const STATE_COOKIE = 'extree_oauth_state';
// Столько же живёт access_token, который Discord выдаёт на этот grant —
// после этого /dashboard просто перекинет на повторный логин.
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Бот сейчас на одном сервере — 5 минут кэша с лихвой достаточно, чтобы
// не дёргать Discord на каждый заход в кабинет, и достаточно коротко,
// чтобы новый сервер бота появился в списке без перезапуска процесса.
const BOT_GUILDS_TTL_MS = 5 * 60 * 1000;
let botGuildsCache = { guilds: null, fetchedAt: 0 };
async function getBotGuilds() {
    if (botGuildsCache.guilds && Date.now() - botGuildsCache.fetchedAt < BOT_GUILDS_TTL_MS) {
        return botGuildsCache.guilds;
    }
    const guilds = await oauth.fetchBotGuilds(BOT_TOKEN);
    botGuildsCache = { guilds, fetchedAt: Date.now() };
    return guilds;
}

function parseCookies(header) {
    const out = {};
    if (!header) return out;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
    return out;
}

const app = express();
// За Caddy (reverse proxy) — иначе req.secure/req.ip смотрели бы на
// соединение с прокси, а не на исходный запрос клиента.
app.set('trust proxy', 1);

app.use((req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
});

app.get('/auth/discord/login', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
    });
    res.redirect(oauth.buildAuthorizeUrl({ clientId: CLIENT_ID, redirectUri: REDIRECT_URI, state }));
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state || state !== req.cookies[STATE_COOKIE]) {
        res.status(400).send(renderError('Ссылка для входа устарела или повреждена — попробуй войти ещё раз.'));
        return;
    }
    res.clearCookie(STATE_COOKIE);
    try {
        const token = await oauth.exchangeCode({
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            redirectUri: REDIRECT_URI,
            code,
        });
        const session = encryptSession({ accessToken: token.access_token, issuedAt: Date.now() }, SESSION_SECRET);
        res.cookie(SESSION_COOKIE, session, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE_MS,
        });
        res.redirect('/dashboard');
    } catch (err) {
        console.error('dashboard: ошибка обмена кода на токен Discord:', err);
        res.status(502).send(renderError('Discord не ответил на запрос входа — попробуй ещё раз чуть позже.'));
    }
});

app.get('/auth/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE);
    res.redirect('/');
});

app.get('/dashboard', async (req, res) => {
    const raw = req.cookies[SESSION_COOKIE];
    const session = raw ? decryptSession(raw, SESSION_SECRET) : null;
    if (!session) {
        res.send(renderLogin());
        return;
    }
    try {
        const [user, userGuilds, botGuilds] = await Promise.all([
            oauth.fetchCurrentUser(session.accessToken),
            oauth.fetchUserGuilds(session.accessToken),
            getBotGuilds(),
        ]);
        const managedGuilds = oauth.intersectManagedGuilds(userGuilds, botGuilds);
        res.send(renderDashboard(user, managedGuilds));
    } catch (err) {
        console.error('dashboard: не удалось загрузить данные пользователя из Discord:', err);
        res.clearCookie(SESSION_COOKIE);
        res.send(renderLogin());
    }
});

app.listen(PORT, () => {
    console.log(`dashboard: слушает порт ${PORT}`);
});
