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
// Запускается отдельным процессом в том же образе, что и сам бот (см.
// docker-compose.yml, сервис dashboard — тот же Dockerfile, другая
// command) и проксируется Caddy по путям /auth/*, /dashboard* (на
// bot.extree.tech) и /, /admin* (на extree.tech) — см. web/Caddyfile,
// остальное на обоих доменах остаётся статикой.
require('dotenv').config({ quiet: true });
const express = require('express');
const crypto = require('crypto');
const oauth = require('./discordOAuth');
const { encryptSession, decryptSession } = require('./session');
const { renderLogin, renderError, renderDashboard } = require('./views');
const { renderVisitka, renderSiteLogin, renderSiteDenied, renderSiteAdminForm } = require('./siteViews');
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

app.use(express.urlencoded({ extended: false }));

app.use((req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
});

// Куда вернуть после логина — единственный способ узнать, с какого из
// двух доменов (bot.extree.tech/dashboard или extree.tech/admin) пришёл
// вход, раз redirect_uri определяется тем же Host-заголовком (см.
// redirectUriFor выше): на bot.extree.tech возвращаем в кабинет, на
// extree.tech/www.extree.tech — в редактор визитки.
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
        res.status(400).send(renderError('Ссылка для входа устарела или повреждена — попробуй войти ещё раз.'));
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

// Контент визитки читается из БД при каждом заходе — её почти никогда не
// правят, кэшировать не нужно, а при недоступности БД лучше молча
// показать дефолтный текст (тот же, что был в статичном index.html до
// этой фичи), чем уронить "/" на весь extree.tech целиком.
async function loadSiteContent() {
    try {
        return await site.load();
    } catch (err) {
        console.error('dashboard: не удалось прочитать контент визитки из БД, показываю значения по умолчанию:', err);
        return site.DEFAULTS;
    }
}

// "Администратор домена" = Administrator/владелец на сервере бота
// (GUILD_ID) — та же проверка, что определяет список серверов в
// /dashboard (oauth.isGuildAdmin), просто для одного конкретного guildId.
async function requireSiteAdmin(req, res) {
    const raw = req.cookies[SESSION_COOKIE];
    const session = raw ? decryptSession(raw, SESSION_SECRET) : null;
    if (!session) {
        res.send(renderSiteLogin());
        return false;
    }
    try {
        const userGuilds = await oauth.fetchUserGuilds(session.accessToken);
        if (!oauth.isSiteAdmin(userGuilds, GUILD_ID)) {
            res.status(403).send(renderSiteDenied());
            return false;
        }
        return true;
    } catch (err) {
        console.error('dashboard: не удалось проверить права на /admin:', err);
        res.clearCookie(SESSION_COOKIE);
        res.send(renderSiteLogin());
        return false;
    }
}

app.get('/', async (req, res) => {
    res.send(renderVisitka(await loadSiteContent()));
});

app.get('/admin', async (req, res) => {
    if (!(await requireSiteAdmin(req, res))) return;
    const content = await loadSiteContent();
    res.send(renderSiteAdminForm(content, { saved: req.query.saved === '1', maxLinks: site.MAX_LINKS }));
});

app.post('/admin', async (req, res) => {
    if (!(await requireSiteAdmin(req, res))) return;
    const links = [];
    for (let i = 1; i <= site.MAX_LINKS; i++) {
        links.push({ label: req.body[`link${i}_label`] ?? '', url: req.body[`link${i}_url`] ?? '' });
    }
    try {
        await site.save({ name: req.body.name ?? '', role: req.body.role ?? '', bio: req.body.bio ?? '', links });
    } catch (err) {
        console.error('dashboard: не удалось сохранить контент визитки:', err);
    }
    res.redirect('/admin?saved=1');
});

app.listen(PORT, () => {
    console.log(`dashboard: слушает порт ${PORT}`);
});
