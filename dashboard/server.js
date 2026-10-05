// Один процесс, два домена, вход везде через Discord OAuth2 — другие
// провайдеры не подключены осознанно, обе фичи ниже отвечают на вопросы
// про Discord-сервера, которые Google/Apple просто не знают:
//
// 1. Личный кабинет (bot.extree.tech/dashboard) — версия "только
//    просмотр": список серверов, где у вошедшего есть права
//    администратора и уже добавлен бот. Сессия целиком в зашифрованной
//    cookie (dashboard/session.js), без БД.
// 2. Редактор визитки (extree.tech/admin) — доступен только
//    администратору сервера бота (GUILD_ID), сам контент визитки ("/")
//    хранится в Postgres (../site/model.js), не в cookie.
//
// Сам UI — React-SPA в frontend/ (см. frontend/src/app/App.tsx), этот
// файл отдаёт только JSON под /api/* и ведёт OAuth2-поток под /auth/* —
// остальной GET (включая client-side роуты SPA вроде /admin и /dashboard)
// получает собранный frontend/dist/index.html, дальше маршрутизацию берёт
// на себя React Router. Запускается отдельным процессом в том же образе,
// что и сам бот (см. docker-compose.yml, сервис dashboard — тот же
// Dockerfile, другая command), проксируется Caddy по путям /auth/*,
// /api/*, /dashboard, /admin и /assets/* (см. web/Caddyfile) — остальное
// на обоих доменах остаётся статикой.
require('dotenv').config({ quiet: true });
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const oauth = require('./discordOAuth');
const { encryptSession, decryptSession } = require('./session');
const site = require('../site/model');

const PORT = process.env.DASHBOARD_PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

for (const [name, value] of Object.entries({
    CLIENT_ID,
    DISCORD_CLIENT_SECRET: CLIENT_SECRET,
    SESSION_SECRET,
    DISCORD_TOKEN: BOT_TOKEN,
    GUILD_ID,
})) {
    if (!value) {
        console.error(`dashboard: переменная окружения ${name} не задана — дашборд не может стартовать.`);
        process.exit(1);
    }
}

// redirect_uri в OAuth2-потоке Discord должен посимвольно совпадать на
// шаге /authorize и на шаге обмена кода на токен — берём его из заголовка
// Host входящего запроса, а не из одной статичной переменной окружения,
// потому что дашборд теперь обслуживает логин на двух доменах
// (bot.extree.tech/dashboard и extree.tech/admin). В Discord Developer
// Portal → OAuth2 → Redirects должны быть зарегистрированы ОБА:
// https://bot.extree.tech/auth/discord/callback и
// https://extree.tech/auth/discord/callback — Caddy всегда проксирует
// сюда по HTTPS, поэтому схема захардкожена.
function redirectUriFor(req) {
    return `https://${req.headers.host}/auth/discord/callback`;
}

const SESSION_COOKIE = 'extree_session';
const STATE_COOKIE = 'extree_oauth_state';
// Столько же живёт access_token, который Discord выдаёт на этот grant —
// после этого API просто начнёт отвечать user: null / 401.
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

function avatarUrl(discordUser) {
    if (discordUser.avatar) {
        return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=64`;
    }
    const fallbackIndex = Number(BigInt(discordUser.id) % 5n);
    return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
}

function getSessionFromReq(req) {
    const raw = req.cookies[SESSION_COOKIE];
    return raw ? decryptSession(raw, SESSION_SECRET) : null;
}

const app = express();
// За Caddy (reverse proxy) — иначе req.secure/req.ip смотрели бы на
// соединение с прокси, а не на исходный запрос клиента.
app.set('trust proxy', 1);

app.use(express.json());

app.use((req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
});

// Куда вернуть после логина — единственный способ узнать, с какого из
// двух доменов (bot.extree.tech/dashboard или extree.tech/admin) пришёл
// вход, раз redirect_uri определяется тем же Host-заголовком (см.
// redirectUriFor выше): на bot.extree.tech возвращаем в кабинет, на
// extree.tech/www.extree.tech — в редактор визитки. Оба пути — обычные
// client-side роуты SPA, отрендерит их React Router после SPA-fallback ниже.
function defaultReturnPathFor(host) {
    return host && host.startsWith('bot.') ? '/dashboard' : '/admin';
}

app.get('/auth/discord/login', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
    });
    res.redirect(oauth.buildAuthorizeUrl({ clientId: CLIENT_ID, redirectUri: redirectUriFor(req), state }));
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state || state !== req.cookies[STATE_COOKIE]) {
        res.redirect(`${defaultReturnPathFor(req.headers.host)}?auth_error=1`);
        return;
    }
    res.clearCookie(STATE_COOKIE);
    try {
        const token = await oauth.exchangeCode({
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            redirectUri: redirectUriFor(req),
            code,
        });
        const session = encryptSession({ accessToken: token.access_token, issuedAt: Date.now() }, SESSION_SECRET);
        res.cookie(SESSION_COOKIE, session, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE_MS,
        });
        res.redirect(defaultReturnPathFor(req.headers.host));
    } catch (err) {
        console.error('dashboard: ошибка обмена кода на токен Discord:', err);
        res.redirect(`${defaultReturnPathFor(req.headers.host)}?auth_error=1`);
    }
});

app.get('/auth/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE);
    res.redirect('/');
});

app.get('/api/session', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
        res.json({ user: null });
        return;
    }
    try {
        const discordUser = await oauth.fetchCurrentUser(session.accessToken);
        res.json({ user: { id: discordUser.id, username: discordUser.username, avatarUrl: avatarUrl(discordUser) } });
    } catch (err) {
        console.error('dashboard: /api/session — не удалось получить пользователя Discord:', err);
        res.clearCookie(SESSION_COOKIE);
        res.json({ user: null });
    }
});

app.get('/api/guilds', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
        res.status(401).json({ error: 'Нужно войти через Discord.' });
        return;
    }
    try {
        const [userGuilds, botGuilds] = await Promise.all([oauth.fetchUserGuilds(session.accessToken), getBotGuilds()]);
        const managed = oauth.intersectManagedGuilds(userGuilds, botGuilds);
        res.json({
            guilds: managed.map(g => ({
                id: g.id,
                name: g.name,
                iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null,
            })),
        });
    } catch (err) {
        console.error('dashboard: /api/guilds — не удалось загрузить сервера из Discord:', err);
        res.status(502).json({ error: 'Discord не ответил, попробуй ещё раз чуть позже.' });
    }
});

// Контент визитки читается из БД при каждом заходе — её почти никогда не
// правят, кэшировать не нужно, а при недоступности БД лучше молча
// показать дефолтный текст, чем уронить "/" на весь extree.tech целиком.
async function loadSiteContent() {
    try {
        return await site.load();
    } catch (err) {
        console.error('dashboard: не удалось прочитать контент визитки из БД, показываю значения по умолчанию:', err);
        return site.DEFAULTS;
    }
}

app.get('/api/site-content', async (req, res) => {
    const content = await loadSiteContent();
    res.json({ ...content, maxLinks: site.MAX_LINKS });
});

// "Администратор домена" = Administrator/владелец на сервере бота
// (GUILD_ID) — та же проверка, что определяет список серверов в
// /api/guilds (oauth.isGuildAdmin), просто для одного конкретного guildId.
app.get('/api/site-admin-status', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
        res.json({ isAdmin: false });
        return;
    }
    try {
        const userGuilds = await oauth.fetchUserGuilds(session.accessToken);
        res.json({ isAdmin: oauth.isSiteAdmin(userGuilds, GUILD_ID) });
    } catch (err) {
        console.error('dashboard: /api/site-admin-status — не удалось проверить права:', err);
        res.json({ isAdmin: false });
    }
});

app.put('/api/site-content', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
        res.status(401).json({ error: 'Нужно войти через Discord.' });
        return;
    }
    try {
        const userGuilds = await oauth.fetchUserGuilds(session.accessToken);
        if (!oauth.isSiteAdmin(userGuilds, GUILD_ID)) {
            res.status(403).json({ error: 'Редактировать визитку может только администратор сервера бота.' });
            return;
        }
    } catch (err) {
        console.error('dashboard: PUT /api/site-content — не удалось проверить права:', err);
        res.status(502).json({ error: 'Discord не ответил, попробуй ещё раз чуть позже.' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    try {
        const saved = await site.save({
            name: typeof body.name === 'string' ? body.name : '',
            role: typeof body.role === 'string' ? body.role : '',
            bio: typeof body.bio === 'string' ? body.bio : '',
            links: Array.isArray(body.links) ? body.links : [],
        });
        res.json({ ...saved, maxLinks: site.MAX_LINKS });
    } catch (err) {
        console.error('dashboard: PUT /api/site-content — не удалось сохранить:', err);
        res.status(500).json({ error: 'Не удалось сохранить — попробуй ещё раз.' });
    }
});

// Собранный React-SPA (frontend/) + SPA-fallback — обязательно после
// всех /api/* и /auth/* роутов выше, иначе catch-all перехватил бы их
// первым. express.static сам отдаёт файлы из dist/ (index.html,
// assets/*.js, assets/*.css, avatar.jpg); если путь не совпал ни с одним
// файлом — значит это client-side роут (/admin, /dashboard, ?auth_error),
// и index.html нужно отдать и для него, дальше маршрутизацию берёт на
// себя React Router.
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(FRONTEND_DIST));
// Express 5 (path-to-regexp v8) больше не принимает голый '*' как путь —
// middleware без пути самый простой способ поймать "всё, что осталось".
app.use((req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`dashboard: слушает порт ${PORT}`);
});
