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
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const oauth = require('./discordOAuth');
const googleOAuth = require('./googleOAuth');
const githubOAuth = require('./githubOAuth');
const accounts = require('./accounts');
const { verifyTelegramAuth } = require('./telegramAuth');
const { encryptSession, decryptSession } = require('./session');
const site = require('../site/model');
const security = require('../security/config');
const presence = require('../presence');
const voice = require('../voice');
const cases = require('../cases');
const tickets = require('../tickets/config');
const moderation = require('../moderation');
const leveling = require('../leveling');

const PORT = process.env.DASHBOARD_PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
// Необязательные провайдеры входа — дашборд стартует и без них, просто
// соответствующая кнопка не показывается (см. GET /api/auth-methods).
// Нужны, когда Discord недоступен пользователю напрямую (блокировки и
// т.п.): вход через Telegram/email ведёт в тот же аккаунт, что уже был
// один раз привязан через Discord OAuth — см. dashboard/accounts.js.
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

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

// Та же схема, что redirectUriFor выше, но для Google — в Google Cloud
// Console → Credentials → OAuth client ID должны быть зарегистрированы
// ОБА https://bot.extree.tech/auth/google/callback и
// https://extree.tech/auth/google/callback.
function redirectUriForGoogle(req) {
    return `https://${req.headers.host}/auth/google/callback`;
}

// Та же схема, но для GitHub — в отличие от Google, GitHub OAuth App
// поддерживает только ОДИН Authorization callback URL при регистрации,
// поэтому в текущей настройке (см. .env.example) GitHub-логин реально
// работает только на основном домене; redirect_uri всё равно берём из
// Host запроса (а не хардкодим домен), чтобы на другом домене код хотя
// бы не ломался на несовпадении, а честно падал в auth_error от самого
// GitHub.
function redirectUriForGithub(req) {
    return `https://${req.headers.host}/auth/github/callback`;
}

const SESSION_COOKIE = 'extree_session';
const STATE_COOKIE = 'extree_oauth_state';
const GOOGLE_STATE_COOKIE = 'extree_oauth_state_google';
const GITHUB_STATE_COOKIE = 'extree_oauth_state_github';
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

// Короче TTL, чем у getBotGuilds выше: список серверов бота меняется
// редко, а каналы/роли админ может создать прямо перед тем, как зайти
// в дашборд выбрать их в форме — минута ожидания терпима, 5 нет.
const GUILD_RESOURCES_TTL_MS = 60 * 1000;
let guildChannelsCache = { channels: null, fetchedAt: 0 };
async function getGuildChannels() {
    if (guildChannelsCache.channels && Date.now() - guildChannelsCache.fetchedAt < GUILD_RESOURCES_TTL_MS) {
        return guildChannelsCache.channels;
    }
    const raw = await oauth.fetchGuildChannels(BOT_TOKEN, GUILD_ID);
    const channels = raw
        .map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parent_id ?? null, position: c.position ?? 0 }))
        .sort((a, b) => a.position - b.position);
    guildChannelsCache = { channels, fetchedAt: Date.now() };
    return channels;
}

let guildRolesCache = { roles: null, fetchedAt: 0 };
async function getGuildRoles() {
    if (guildRolesCache.roles && Date.now() - guildRolesCache.fetchedAt < GUILD_RESOURCES_TTL_MS) {
        return guildRolesCache.roles;
    }
    const raw = await oauth.fetchGuildRoles(BOT_TOKEN, GUILD_ID);
    const roles = raw
        .filter(r => !r.managed && r.id !== GUILD_ID)
        .map(r => ({ id: r.id, name: r.name, position: r.position ?? 0 }))
        .sort((a, b) => b.position - a.position);
    guildRolesCache = { roles, fetchedAt: Date.now() };
    return roles;
}

// Полный список ролей сервера (включая managed/интеграционные — роль
// буста, роли ботов и т.п.), БЕЗ фильтра getGuildRoles() выше: тот
// фильтр существует для пикера ролей в формах настроек (туда managed-
// роль руками не назначишь, нет смысла показывать), а не для отображения
// уже существующих ролей участника на "Участниках" — там нужны имена
// ВСЕХ ролей, иначе у роли, отфильтрованной из пикера, участнику вместо
// имени показывался бы её сырой Discord ID (что и было багом).
let allGuildRolesCache = { roles: null, fetchedAt: 0 };
async function getAllGuildRolesById() {
    if (allGuildRolesCache.roles && Date.now() - allGuildRolesCache.fetchedAt < GUILD_RESOURCES_TTL_MS) {
        return allGuildRolesCache.roles;
    }
    const raw = await oauth.fetchRawGuildRoles(BOT_TOKEN, GUILD_ID);
    const byId = new Map(raw.filter(r => r.id !== GUILD_ID).map(r => [r.id, r.name]));
    allGuildRolesCache = { roles: byId, fetchedAt: Date.now() };
    return byId;
}

// Полный ростер участников — тот же TTL-кэш, что у каналов/ролей выше:
// списки "Участники"/"В муте"/"Лидерборд" (см. ниже) каждый по-своему
// используют один и тот же полный список, не нужно гонять Discord за
// тысячами участников на каждый из них по отдельности.
let guildMembersCache = { members: null, fetchedAt: 0 };
async function getGuildMembersCached() {
    if (guildMembersCache.members && Date.now() - guildMembersCache.fetchedAt < GUILD_RESOURCES_TTL_MS) {
        return guildMembersCache.members;
    }
    const members = await oauth.fetchGuildMembers(BOT_TOKEN, GUILD_ID);
    guildMembersCache = { members, fetchedAt: Date.now() };
    return members;
}

// Профиль самого бота (имя + аватар) — для бренд-плашки "Extree" на
// фронте (GET /api/bot-info ниже). Та же TTL-кэш-схема, что у
// getBotGuilds выше: аватар/имя бота меняются даже реже, чем список его
// серверов, но нет смысла заводить отдельную константу под них.
let botUserCache = { user: null, fetchedAt: 0 };
async function getBotUserCached() {
    if (botUserCache.user && Date.now() - botUserCache.fetchedAt < BOT_GUILDS_TTL_MS) {
        return botUserCache.user;
    }
    const user = await oauth.fetchBotUser(BOT_TOKEN);
    botUserCache = { user, fetchedAt: Date.now() };
    return user;
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

// size по умолчанию 64 — как и было у всех существующих вызовов
// (аватарки пользователей в таблицах/профиле); бренд-плашка бота
// (GET /api/bot-info) передаёт 128 — она крупнее и на retina-экранах 64
// будет видно мыльной.
function avatarUrl(discordUser, size = 64) {
    if (discordUser.avatar) {
        return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=${size}`;
    }
    const fallbackIndex = Number(BigInt(discordUser.id) % 5n);
    return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
}

function getSessionFromReq(req) {
    const raw = req.cookies[SESSION_COOKIE];
    return raw ? decryptSession(raw, SESSION_SECRET) : null;
}

// "Администратор домена" = Administrator/владелец на сервере бота
// (GUILD_ID) — единый гейт для всего, что можно менять с сайта
// (визитка, настройки безопасности и дальше): /api/site-admin-status,
// PUT /api/site-content, GET/PUT /api/security-settings.
//
// Проверяется через бот-токен по discordId привязанного аккаунта
// (dashboard/accounts.js), а не через access_token самого пользователя —
// так права работают одинаково независимо от того, как именно он вошёл
// в этот раз (Discord/Telegram/email), и не зависят от живого доступа
// браузера пользователя к discord.com.
async function isRequestSiteAdmin(req) {
    const session = getSessionFromReq(req);
    if (!session) return false;
    try {
        const account = await accounts.findById(session.accountId);
        if (!account) return false;
        return await oauth.isGuildAdminById(BOT_TOKEN, GUILD_ID, account.discordId);
    } catch (err) {
        console.error('dashboard: не удалось проверить права администратора:', err);
        return false;
    }
}

const app = express();
// За Caddy (reverse proxy) — иначе req.secure/req.ip смотрели бы на
// соединение с прокси, а не на исходный запрос клиента (и rate-limit
// ниже считал бы все запросы с одного IP прокси).
app.set('trust proxy', 1);

// Стандартный набор security-заголовков (helmet = CSP, X-Frame-Options/
// frame-ancestors, X-Content-Type-Options: nosniff, Referrer-Policy,
// HSTS и т.п.) — CSP разрешает ровно то, что реально грузит фронтенд:
// Google Fonts (styleSrc/fontSrc), официальный Telegram Login Widget
// (scriptSrc — сам скрипт; frameSrc — его iframe с oauth.telegram.org,
// см. features/telegram-auth/TelegramLoginButton.tsx), аватарки Discord
// (imgSrc). crossOriginEmbedderPolicy выключен явно — иначе ломает
// встраивание чужого (Telegram) iframe без Cross-Origin-Resource-Policy
// на их стороне, на что мы повлиять не можем.
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", 'https://telegram.org'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'],
                connectSrc: ["'self'"],
                frameSrc: ['https://oauth.telegram.org'],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    })
);

// Общий rate-limit на все /api/* и /auth/* — защита от перебора/грубого
// DoS на уровне процесса, в дополнение к прицельному лимитеру на
// /auth/email/login ниже (у него лимит жёстче и ключ — IP, не email).
// 300 запросов/5 минут с одного IP — SPA на обычном заходе делает от
// силы десяток запросов, этого хватает с большим запасом для реальных
// пользователей, но не для перебора.
const apiRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(['/api', '/auth'], apiRateLimiter);

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
        const discordUser = await oauth.fetchCurrentUser(token.access_token);
        const account = await accounts.findOrCreateByDiscordId(discordUser.id, {
            username: discordUser.username,
            avatar: discordUser.avatar,
        });
        const session = encryptSession({ accountId: account.id, issuedAt: Date.now() }, SESSION_SECRET);
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

// clearCookie с теми же атрибутами, что были при установке (httpOnly/
// secure/sameSite/path) — иначе в части браузеров cookie тихо не
// очищается: совпадать должны домен+путь (а для некоторых браузеров и
// SameSite), это не просто стиль. Токенов для очистки на клиенте больше
// нет: сессия только в этой httpOnly-cookie, в localStorage лежат
// исключительно непривилегированные настройки UI (тема/язык/свёрнутый
// сайдбар) — их намеренно не трогаем при логауте, это не секреты.
app.get('/auth/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    res.redirect('/');
});

// Telegram Login Widget редиректит сюда с подписанными query-параметрами
// (см. dashboard/telegramAuth.js). Два сценария по одному и тому же
// роуту: если уже есть валидная сессия (вошли через Discord/email) — это
// привязка Telegram к текущему аккаунту; если сессии нет — это попытка
// входа по уже привязанному Telegram.
app.get('/auth/telegram/callback', async (req, res) => {
    const returnTo = defaultReturnPathFor(req.headers.host);
    if (!TELEGRAM_BOT_TOKEN) {
        res.redirect(`${returnTo}?auth_error=1`);
        return;
    }
    if (!verifyTelegramAuth(req.query, TELEGRAM_BOT_TOKEN)) {
        res.redirect(`${returnTo}?auth_error=1`);
        return;
    }
    const telegramId = String(req.query.id);
    const telegramUsername = typeof req.query.username === 'string' ? req.query.username : null;
    try {
        const existingSession = getSessionFromReq(req);
        if (existingSession) {
            const account = await accounts.findById(existingSession.accountId);
            if (!account) {
                res.redirect(`${returnTo}?auth_error=1`);
                return;
            }
            await accounts.linkTelegram(account.id, telegramId, telegramUsername);
            res.redirect(`${returnTo}?telegram_linked=1`);
            return;
        }
        const account = await accounts.findByTelegramId(telegramId);
        if (!account) {
            res.redirect(`${returnTo}?telegram_not_linked=1`);
            return;
        }
        const session = encryptSession({ accountId: account.id, issuedAt: Date.now() }, SESSION_SECRET);
        res.cookie(SESSION_COOKIE, session, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE_MS,
        });
        res.redirect(returnTo);
    } catch (err) {
        if (err.message === 'telegram_already_linked') {
            res.redirect(`${returnTo}?auth_error=telegram_taken`);
            return;
        }
        console.error('dashboard: /auth/telegram/callback:', err);
        res.redirect(`${returnTo}?auth_error=1`);
    }
});

// Google — тот же паттерн, что Discord-логин выше (стандартный redirect
// OAuth2, без виджета/SDK, в отличие от Telegram), поэтому работает
// одинаково на обоих доменах без isDashboardDomain-гейта.
app.get('/auth/google/login', (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
        res.redirect(`${defaultReturnPathFor(req.headers.host)}?auth_error=1`);
        return;
    }
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(GOOGLE_STATE_COOKIE, state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
    });
    res.redirect(
        googleOAuth.buildAuthorizeUrl({ clientId: GOOGLE_CLIENT_ID, redirectUri: redirectUriForGoogle(req), state })
    );
});

// Та же развилка привязка/вход, что у /auth/telegram/callback выше: с
// активной сессией — привязка Google к текущему аккаунту, без сессии —
// попытка входа по уже привязанному Google-аккаунту.
app.get('/auth/google/callback', async (req, res) => {
    const returnTo = defaultReturnPathFor(req.headers.host);
    const { code, state } = req.query;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !code || !state || state !== req.cookies[GOOGLE_STATE_COOKIE]) {
        res.redirect(`${returnTo}?auth_error=1`);
        return;
    }
    res.clearCookie(GOOGLE_STATE_COOKIE);
    try {
        const token = await googleOAuth.exchangeCode({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            redirectUri: redirectUriForGoogle(req),
            code,
        });
        const googleUser = await googleOAuth.fetchCurrentUser(token.access_token);
        const existingSession = getSessionFromReq(req);
        if (existingSession) {
            const account = await accounts.findById(existingSession.accountId);
            if (!account) {
                res.redirect(`${returnTo}?auth_error=1`);
                return;
            }
            await accounts.linkGoogle(account.id, googleUser.sub, googleUser.email ?? null);
            res.redirect(`${returnTo}?google_linked=1`);
            return;
        }
        const account = await accounts.findByGoogleId(googleUser.sub);
        if (!account) {
            res.redirect(`${returnTo}?google_not_linked=1`);
            return;
        }
        const session = encryptSession({ accountId: account.id, issuedAt: Date.now() }, SESSION_SECRET);
        res.cookie(SESSION_COOKIE, session, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE_MS,
        });
        res.redirect(returnTo);
    } catch (err) {
        if (err.message === 'google_already_linked') {
            res.redirect(`${returnTo}?auth_error=google_taken`);
            return;
        }
        console.error('dashboard: /auth/google/callback:', err);
        res.redirect(`${returnTo}?auth_error=1`);
    }
});

// GitHub — тот же паттерн, что Google выше.
app.get('/auth/github/login', (req, res) => {
    if (!GITHUB_CLIENT_ID) {
        res.redirect(`${defaultReturnPathFor(req.headers.host)}?auth_error=1`);
        return;
    }
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(GITHUB_STATE_COOKIE, state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
    });
    res.redirect(
        githubOAuth.buildAuthorizeUrl({ clientId: GITHUB_CLIENT_ID, redirectUri: redirectUriForGithub(req), state })
    );
});

// Та же развилка привязка/вход, что у /auth/google/callback выше: с
// активной сессией — привязка GitHub к текущему аккаунту, без сессии —
// попытка входа по уже привязанному GitHub-аккаунту.
app.get('/auth/github/callback', async (req, res) => {
    const returnTo = defaultReturnPathFor(req.headers.host);
    const { code, state } = req.query;
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !code || !state || state !== req.cookies[GITHUB_STATE_COOKIE]) {
        res.redirect(`${returnTo}?auth_error=1`);
        return;
    }
    res.clearCookie(GITHUB_STATE_COOKIE);
    try {
        const token = await githubOAuth.exchangeCode({
            clientId: GITHUB_CLIENT_ID,
            clientSecret: GITHUB_CLIENT_SECRET,
            redirectUri: redirectUriForGithub(req),
            code,
        });
        const githubUser = await githubOAuth.fetchCurrentUser(token.access_token);
        // GitHub отдаёт id числом, а не строкой — приводим к string, как
        // discordId/googleId в dashboard/accounts.js.
        const githubId = String(githubUser.id);
        const existingSession = getSessionFromReq(req);
        if (existingSession) {
            const account = await accounts.findById(existingSession.accountId);
            if (!account) {
                res.redirect(`${returnTo}?auth_error=1`);
                return;
            }
            await accounts.linkGithub(account.id, githubId, githubUser.login ?? null);
            res.redirect(`${returnTo}?github_linked=1`);
            return;
        }
        const account = await accounts.findByGithubId(githubId);
        if (!account) {
            res.redirect(`${returnTo}?github_not_linked=1`);
            return;
        }
        const session = encryptSession({ accountId: account.id, issuedAt: Date.now() }, SESSION_SECRET);
        res.cookie(SESSION_COOKIE, session, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE_MS,
        });
        res.redirect(returnTo);
    } catch (err) {
        if (err.message === 'github_already_linked') {
            res.redirect(`${returnTo}?auth_error=github_taken`);
            return;
        }
        console.error('dashboard: /auth/github/callback:', err);
        res.redirect(`${returnTo}?auth_error=1`);
    }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Грубая защита от подбора пароля по email — ключ IP, не email: иначе
// можно было бы перебирать разные email без ограничения с одного адреса.
// Не замена нормальному rate-limiter перед прокси, но достаточно, чтобы
// сам процесс дашборда не был бесплатным оракулом для брутфорса.
const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const loginAttemptsByIp = new Map();
function isLoginRateLimited(ip) {
    const now = Date.now();
    const attempts = (loginAttemptsByIp.get(ip) || []).filter(t => now - t < LOGIN_ATTEMPT_WINDOW_MS);
    attempts.push(now);
    loginAttemptsByIp.set(ip, attempts);
    return attempts.length > LOGIN_ATTEMPT_LIMIT;
}

app.post('/auth/email/login', async (req, res) => {
    if (isLoginRateLimited(req.ip)) {
        res.status(429).json({ error: 'Слишком много попыток входа, попробуй через 15 минут.' });
        return;
    }
    const { email, password } = req.body && typeof req.body === 'object' ? req.body : {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        res.status(400).json({ error: 'Укажи email и пароль.' });
        return;
    }
    try {
        const account = await accounts.verifyEmailLogin(email.trim().toLowerCase(), password);
        if (!account) {
            res.status(401).json({ error: 'Неверный email или пароль.' });
            return;
        }
        const session = encryptSession({ accountId: account.id, issuedAt: Date.now() }, SESSION_SECRET);
        res.cookie(SESSION_COOKIE, session, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE_MS,
        });
        res.json({ ok: true });
    } catch (err) {
        console.error('dashboard: /auth/email/login:', err);
        res.status(500).json({ error: 'Не удалось войти — попробуй ещё раз.' });
    }
});

// Задать email+пароль как дополнительный способ входа — требует уже
// активной сессии (Discord/Telegram): это привязка, не самостоятельная
// регистрация, иначе кто угодно мог бы завести пароль без Discord-аккаунта
// за спиной и получить вход в чужой уже привязанный email.
app.post('/auth/email/set-password', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
        res.status(401).json({ error: 'Нужно войти.' });
        return;
    }
    const { email, password } = req.body && typeof req.body === 'object' ? req.body : {};
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
        res.status(400).json({ error: 'Некорректный email.' });
        return;
    }
    if (typeof password !== 'string' || password.length < 8) {
        res.status(400).json({ error: 'Пароль должен быть не короче 8 символов.' });
        return;
    }
    try {
        await accounts.setPassword(session.accountId, email.trim().toLowerCase(), password);
        res.json({ ok: true });
    } catch (err) {
        if (err.message === 'email_already_used') {
            res.status(409).json({ error: 'Этот email уже используется другим аккаунтом.' });
            return;
        }
        console.error('dashboard: /auth/email/set-password:', err);
        res.status(500).json({ error: 'Не удалось сохранить — попробуй ещё раз.' });
    }
});

// Какие способы входа вообще включены на этом окружении — Telegram
// требует TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_USERNAME, без них кнопка
// на фронте просто не показывается (см. README/.env.example).
app.get('/api/auth-methods', (req, res) => {
    res.json({
        telegram: TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_USERNAME ? { botUsername: TELEGRAM_BOT_USERNAME } : null,
        google: GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET ? { enabled: true } : null,
        github: GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET ? { enabled: true } : null,
    });
});

// Публичный, тот же уровень доверия, что у /api/auth-methods выше: имя и
// аватар бота — не секрет, их и так видно в самом Discord. Нужен фронту,
// чтобы бренд-плашка "Extree" (сайдбар кабинета, denied-экран, маркетинг-
// колонка логина) показывала настоящую аватарку бота вместо
// захардкоженной буквы "E" (см. shared/ui/BrandMark.tsx). avatarUrl:
// null, если у бота явно не выставлен аватар — тогда фронт сам
// показывает буквенный фолбэк, вместо того чтобы подставлять сюда общую
// дефолтную аватарку Discord (она никак не про бренд бота).
app.get('/api/bot-info', async (req, res) => {
    try {
        const botUser = await getBotUserCached();
        res.json({
            name: botUser.global_name ?? botUser.username,
            avatarUrl: botUser.avatar ? avatarUrl(botUser, 128) : null,
        });
    } catch (err) {
        console.error('dashboard: /api/bot-info — не удалось загрузить профиль бота:', err);
        res.status(502).json({ error: 'Discord не ответил, попробуй ещё раз чуть позже.' });
    }
});

// Какие способы входа уже привязаны к текущему аккаунту — для раздела
// "Способы входа" в настройках (показать, что уже подключено, и дать
// привязать остальное).
app.get('/api/linked-accounts', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
        res.status(401).json({ error: 'Нужно войти.' });
        return;
    }
    const account = await accounts.findById(session.accountId);
    if (!account) {
        res.status(401).json({ error: 'Нужно войти.' });
        return;
    }
    res.json({
        discordUsername: account.discordUsername,
        telegramUsername: account.telegramUsername,
        googleEmail: account.googleEmail,
        githubUsername: account.githubUsername,
        hasPassword: Boolean(account.passwordHash),
        email: account.email,
    });
});

app.get('/api/session', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
        res.json({ user: null });
        return;
    }
    const account = await accounts.findById(session.accountId);
    if (!account) {
        res.clearCookie(SESSION_COOKIE);
        res.json({ user: null });
        return;
    }
    res.json({
        user: {
            id: account.discordId,
            username: account.discordUsername ?? account.discordId,
            avatarUrl: avatarUrl({ id: account.discordId, avatar: account.discordAvatar }),
        },
    });
});

app.get('/api/guilds', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
        res.status(401).json({ error: 'Нужно войти.' });
        return;
    }
    try {
        const account = await accounts.findById(session.accountId);
        if (!account) {
            res.status(401).json({ error: 'Нужно войти.' });
            return;
        }
        const isAdmin = await oauth.isGuildAdminById(BOT_TOKEN, GUILD_ID, account.discordId);
        if (!isAdmin) {
            res.json({ guilds: [] });
            return;
        }
        const botGuilds = await getBotGuilds();
        const guild = botGuilds.find(g => g.id === GUILD_ID);
        res.json({
            guilds: guild
                ? [
                      {
                          id: guild.id,
                          name: guild.name,
                          iconUrl: guild.icon
                              ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`
                              : null,
                      },
                  ]
                : [],
        });
    } catch (err) {
        console.error('dashboard: /api/guilds — не удалось загрузить сервер из Discord:', err);
        res.status(502).json({ error: 'Discord не ответил, попробуй ещё раз чуть позже.' });
    }
});

const DAY_MS = 24 * 60 * 60 * 1000;

// Реальные цифры для карточек на "Обзоре" — вместо одного приветствия и
// списка серверов. Участники/онлайн — живой REST-запрос к Discord
// (approximate_member_count/approximate_presence_count, см.
// fetchGuildWithCounts), всё остальное — чтение уже существующих
// Postgres-сторов других модулей бота (тот же приём, что
// security-settings/presence-settings/voice-settings выше: дашборд и бот
// — разные процессы без общей памяти, общее у них только БД и Discord
// REST, см. docker-compose.yml).
app.get('/api/guild-stats', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    try {
        const [guild, recentCases, securityConfig, ticketsConfig] = await Promise.all([
            oauth.fetchGuildWithCounts(BOT_TOKEN, GUILD_ID),
            cases.countRecentCases(GUILD_ID, Date.now() - DAY_MS),
            security.load(),
            tickets.load(),
        ]);
        const securityModulesActive = [
            securityConfig.automod.enabled,
            securityConfig.raidShield.enabled,
            securityConfig.antiNuke.enabled,
        ].filter(Boolean).length;
        res.json({
            memberCount: guild.approximate_member_count ?? null,
            onlineCount: guild.approximate_presence_count ?? null,
            recentCases,
            securityModulesActive,
            securityModulesTotal: 3,
            openTickets: Object.keys(ticketsConfig.ticketsById).length,
        });
    } catch (err) {
        console.error('dashboard: /api/guild-stats — не удалось собрать статистику:', err);
        res.status(502).json({ error: 'Не удалось загрузить статистику, попробуй ещё раз чуть позже.' });
    }
});

// Полный ростер сервера — "Участники" в дашборде. Отдаём всё разом
// (не постранично с курсором от Discord наружу): фронтенд сам фильтрует/
// сортирует/пагинирует уже загруженный список (DataTable), сервер не
// должен знать про текущую страницу/поиск UI — тот же подход, что уже
// был у /api/guild-channels и /api/guild-roles.
app.get('/api/guild-members', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    try {
        const [rawMembers, roleNameById] = await Promise.all([getGuildMembersCached(), getAllGuildRolesById()]);
        res.json({
            members: rawMembers.map(m => ({
                id: m.user.id,
                username: m.user.username,
                globalName: m.user.global_name ?? null,
                avatarUrl: avatarUrl(m.user),
                roles: (m.roles || []).map(id => ({ id, name: roleNameById.get(id) ?? id })),
                joinedAt: m.joined_at ?? null,
            })),
        });
    } catch (err) {
        console.error('dashboard: /api/guild-members — не удалось загрузить участников:', err);
        res.status(502).json({ error: 'Discord не ответил, попробуй ещё раз чуть позже.' });
    }
});

// "В муте" — кастомный мут этого бота (роль Muted + запись в Postgres,
// см. moderation/model.js), НЕ нативный Discord timeout — этот бот его
// не использует (см. комментарий у muteMember). Запись в сторе живёт,
// пока не истечёт expiresAt — sweep (moderation/sweep.js) чистит
// просроченные раз в минуту, так что всё, что здесь есть, считается
// актуальным без дополнительной проверки на фронте.
app.get('/api/muted-members', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    try {
        const [mutes, rawMembers] = await Promise.all([moderation.getConfig(), getGuildMembersCached()]);
        const userById = new Map(rawMembers.map(m => [m.user.id, m.user]));
        const prefix = `${GUILD_ID}_`;
        const muted = Object.entries(mutes)
            .filter(([key]) => key.startsWith(prefix))
            .map(([key, entry]) => {
                const userId = key.slice(prefix.length);
                const user = userById.get(userId);
                return {
                    id: userId,
                    username: user?.username ?? null,
                    globalName: user?.global_name ?? null,
                    avatarUrl: user ? avatarUrl(user) : null,
                    reason: entry.reason ?? null,
                    mutedBy: entry.mutedBy ?? null,
                    mutedAt: entry.mutedAt ?? null,
                    expiresAt: entry.expiresAt ?? null,
                };
            })
            .sort((a, b) => (b.mutedAt ?? 0) - (a.mutedAt ?? 0));
        res.json({ muted });
    } catch (err) {
        console.error('dashboard: /api/muted-members — не удалось загрузить список:', err);
        res.status(502).json({ error: 'Не удалось загрузить список, попробуй ещё раз чуть позже.' });
    }
});

// Забаненные — живой список от Discord (GET /guilds/{id}/bans), он не
// знает ни модератора, ни когда бан выдан. Дополняем этим из
// собственного журнала /ban (cases/) там, где он есть — бан мог быть
// выдан и не через бота (вручную в Discord, через automod/antiNuke,
// которые в cases/ не пишут, см. комментарий в cases/model.js), тогда
// moderatorTag/bannedAt просто остаются null, а не падаем и не врём.
app.get('/api/banned-members', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    try {
        const [bans, caseList] = await Promise.all([
            oauth.fetchGuildBans(BOT_TOKEN, GUILD_ID),
            cases.getCasesForGuild(GUILD_ID),
        ]);
        const lastBanCaseByTarget = new Map();
        for (const c of caseList) {
            if (c.type === 'ban' && !lastBanCaseByTarget.has(c.targetId)) {
                lastBanCaseByTarget.set(c.targetId, c);
            }
        }
        const banned = bans.map(b => {
            const info = lastBanCaseByTarget.get(b.user.id);
            return {
                id: b.user.id,
                username: b.user.username,
                globalName: b.user.global_name ?? null,
                avatarUrl: avatarUrl(b.user),
                reason: info?.reason ?? b.reason ?? null,
                moderatorTag: info?.moderatorTag ?? null,
                bannedAt: info?.createdAt ?? null,
            };
        });
        res.json({ banned });
    } catch (err) {
        console.error('dashboard: /api/banned-members — не удалось загрузить список:', err);
        res.status(502).json({ error: 'Discord не ответил, попробуй ещё раз чуть позже.' });
    }
});

// Лидерборд уровней — та же сортировка, что у /level leaderboard в
// Discord (leveling.getLeaderboard), просто без рендера в PNG-карточку.
// rank проставляется здесь же, по индексу уже отсортированного списка —
// getLeaderboard сам ранг не считает (см. commands/general/level.js).
app.get('/api/leaderboard', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    try {
        const [top, rawMembers] = await Promise.all([
            leveling.getLeaderboard(GUILD_ID, Infinity),
            getGuildMembersCached(),
        ]);
        const userById = new Map(rawMembers.map(m => [m.user.id, m.user]));
        const leaderboard = top.map((entry, index) => {
            const user = userById.get(entry.userId);
            return {
                rank: index + 1,
                id: entry.userId,
                username: user?.username ?? null,
                globalName: user?.global_name ?? null,
                avatarUrl: user ? avatarUrl(user) : null,
                score: entry.score,
                messageCount: entry.messageCount,
                voiceMinutes: entry.voiceMinutes,
                prestige: entry.prestige,
            };
        });
        res.json({ leaderboard });
    } catch (err) {
        console.error('dashboard: /api/leaderboard — не удалось загрузить лидерборд:', err);
        res.status(502).json({ error: 'Не удалось загрузить лидерборд, попробуй ещё раз чуть позже.' });
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

app.get('/api/site-admin-status', async (req, res) => {
    res.json({ isAdmin: await isRequestSiteAdmin(req) });
});

app.put('/api/site-content', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Редактировать визитку может только администратор сервера бота.' });
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

// Настройки безопасности (automod/raid shield/anti-nuke/бан-слова) —
// первый срез "управления ботом через сайт" (по запросу администратора),
// дальше ожидаются другие модули. Та же security/config.js, что уже
// читают /automod и остальные команды — правки отсюда применяются сразу,
// без перезапуска бота, ровно как если бы их внесли командой в Discord.
// Каналы/роли (verification, trusted-роль, лог-канал) сюда намеренно не
// вынесены — их редактирование потребует подтягивать список каналов/ролей
// сервера живьём через Discord API, это отдельная задача.
function pickSecuritySettings(config) {
    return {
        automod: {
            enabled: config.automod.enabled,
            maxMentions: config.automod.maxMentions,
            maxMessagesPerWindow: config.automod.maxMessagesPerWindow,
            messageWindowMs: config.automod.messageWindowMs,
            allowedInviteCodes: config.automod.allowedInviteCodes,
        },
        raidShield: {
            enabled: config.raidShield.enabled,
            joinThreshold: config.raidShield.joinThreshold,
            windowMs: config.raidShield.windowMs,
            lockdownMs: config.raidShield.lockdownMs,
            kickNewAccounts: config.raidShield.kickNewAccounts,
            newAccountAgeMs: config.raidShield.newAccountAgeMs,
        },
        antiNuke: {
            enabled: config.antiNuke.enabled,
            maxActions: config.antiNuke.maxActions,
            windowMs: config.antiNuke.windowMs,
        },
        bannedWords: config.bannedWords,
    };
}

function toNonNegativeInt(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

function toStringList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
}

app.get('/api/security-settings', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    try {
        const config = await security.load();
        res.json(pickSecuritySettings(config));
    } catch (err) {
        console.error('dashboard: GET /api/security-settings — не удалось прочитать конфиг:', err);
        res.status(500).json({ error: 'Не удалось загрузить настройки.' });
    }
});

app.put('/api/security-settings', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const automodIn = body.automod && typeof body.automod === 'object' ? body.automod : {};
    const raidShieldIn = body.raidShield && typeof body.raidShield === 'object' ? body.raidShield : {};
    const antiNukeIn = body.antiNuke && typeof body.antiNuke === 'object' ? body.antiNuke : {};

    try {
        await security.update(config => {
            config.automod.enabled = Boolean(automodIn.enabled);
            config.automod.maxMentions = toNonNegativeInt(automodIn.maxMentions, config.automod.maxMentions);
            config.automod.maxMessagesPerWindow = toNonNegativeInt(
                automodIn.maxMessagesPerWindow,
                config.automod.maxMessagesPerWindow
            );
            config.automod.messageWindowMs = toNonNegativeInt(
                automodIn.messageWindowMs,
                config.automod.messageWindowMs
            );
            config.automod.allowedInviteCodes = toStringList(automodIn.allowedInviteCodes);

            config.raidShield.enabled = Boolean(raidShieldIn.enabled);
            config.raidShield.joinThreshold = toNonNegativeInt(
                raidShieldIn.joinThreshold,
                config.raidShield.joinThreshold
            );
            config.raidShield.windowMs = toNonNegativeInt(raidShieldIn.windowMs, config.raidShield.windowMs);
            config.raidShield.lockdownMs = toNonNegativeInt(raidShieldIn.lockdownMs, config.raidShield.lockdownMs);
            config.raidShield.kickNewAccounts = Boolean(raidShieldIn.kickNewAccounts);
            config.raidShield.newAccountAgeMs = toNonNegativeInt(
                raidShieldIn.newAccountAgeMs,
                config.raidShield.newAccountAgeMs
            );

            config.antiNuke.enabled = Boolean(antiNukeIn.enabled);
            config.antiNuke.maxActions = toNonNegativeInt(antiNukeIn.maxActions, config.antiNuke.maxActions);
            config.antiNuke.windowMs = toNonNegativeInt(antiNukeIn.windowMs, config.antiNuke.windowMs);

            config.bannedWords = toStringList(body.bannedWords);
        });
        const saved = await security.load();
        res.json(pickSecuritySettings(saved));
    } catch (err) {
        console.error('dashboard: PUT /api/security-settings — не удалось сохранить:', err);
        res.status(500).json({ error: 'Не удалось сохранить — попробуй ещё раз.' });
    }
});

// Статус бота (rich presence) — второй модуль управления через сайт
// после настроек безопасности, та же пара GET/PUT + isRequestSiteAdmin.
// В отличие от security-settings правки здесь не применяются мгновенно:
// у процесса dashboard нет живого discord.js-клиента, чтобы вызвать
// setPresence напрямую — presence/model.js tick() подхватывает изменение
// в БД в течение TICK_MS (30 секунд), см. комментарий там.
const ACTIVITY_KEY_BY_TYPE = Object.fromEntries(
    Object.entries(presence.ACTIVITY_TYPES).map(([key, type]) => [type, key])
);

function toActivityKey(type) {
    return ACTIVITY_KEY_BY_TYPE[type] ?? 'playing';
}

function toActivityType(key) {
    return presence.ACTIVITY_TYPES[key] ?? presence.ACTIVITY_TYPES.playing;
}

function pickActivityItem(item) {
    return {
        type: toActivityKey(item?.type),
        text: typeof item?.text === 'string' ? item.text : null,
        url: typeof item?.url === 'string' ? item.url : null,
    };
}

function pickPresenceSettings(config) {
    return {
        status: config.status,
        rotate: config.rotate,
        rotateIntervalMs: config.rotateIntervalMs,
        activity: pickActivityItem(config.activity),
        rotateItems: config.rotateItems.map(pickActivityItem),
    };
}

const PRESENCE_STATUSES = new Set(['online', 'idle', 'dnd', 'invisible']);

function toActivityItemInput(item) {
    const typeKey = typeof item?.type === 'string' ? item.type : 'playing';
    const type = toActivityType(typeKey);
    const text = typeof item?.text === 'string' ? item.text.trim().slice(0, 128) : '';
    const rawUrl = typeof item?.url === 'string' ? item.url.trim() : '';
    const url = type === presence.ACTIVITY_TYPES.streaming && presence.isValidStreamUrl(rawUrl) ? rawUrl : null;
    return { type, text: text || null, url };
}

app.get('/api/presence-settings', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    try {
        const config = await presence.getConfig();
        res.json(pickPresenceSettings(config));
    } catch (err) {
        console.error('dashboard: GET /api/presence-settings — не удалось прочитать конфиг:', err);
        res.status(500).json({ error: 'Не удалось загрузить настройки.' });
    }
});

app.put('/api/presence-settings', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const rotateItemsIn = Array.isArray(body.rotateItems) ? body.rotateItems : [];

    try {
        await presence.updateConfig(cfg => {
            cfg.status = PRESENCE_STATUSES.has(body.status) ? body.status : cfg.status;
            cfg.rotate = Boolean(body.rotate);
            cfg.rotateIntervalMs =
                toNonNegativeInt(body.rotateIntervalMs, cfg.rotateIntervalMs) || cfg.rotateIntervalMs;
            cfg.activity = toActivityItemInput(body.activity);
            cfg.rotateItems = rotateItemsIn.map(toActivityItemInput).filter(item => item.text);
            if (cfg.rotateIndex >= cfg.rotateItems.length) cfg.rotateIndex = 0;
        });
        const saved = await presence.getConfig();
        res.json(pickPresenceSettings(saved));
    } catch (err) {
        console.error('dashboard: PUT /api/presence-settings — не удалось сохранить:', err);
        res.status(500).json({ error: 'Не удалось сохранить — попробуй ещё раз.' });
    }
});

// Живой список каналов/ролей сервера бота — чтобы в формах вроде
// voice-settings ниже выбирать канал/роль из выпадающего списка по
// имени, а не вставлять руками его ID. Та же проверка прав, что у
// остальных настроек — список каналов/ролей не публичная информация.
app.get('/api/guild-channels', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    try {
        res.json({ channels: await getGuildChannels() });
    } catch (err) {
        console.error('dashboard: GET /api/guild-channels — не удалось загрузить список из Discord:', err);
        res.status(502).json({ error: 'Discord не ответил, попробуй ещё раз чуть позже.' });
    }
});

app.get('/api/guild-roles', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    try {
        res.json({ roles: await getGuildRoles() });
    } catch (err) {
        console.error('dashboard: GET /api/guild-roles — не удалось загрузить список из Discord:', err);
        res.status(502).json({ error: 'Discord не ответил, попробуй ещё раз чуть позже.' });
    }
});

// Временные голосовые комнаты — третий модуль управления через сайт.
// В отличие от presence-settings здесь нет лага применения: voice/
// handlers.js и model.js читают config.load() заново на каждое
// взаимодействие (нажатие кнопки триггер-канала, открытие панели и
// т.д.), а не держат значение в памяти процесса — правка с сайта
// действует с первого же следующего клика, без перезапуска бота.
function pickVoiceSettings(config) {
    return {
        triggerChannelId: config.triggerChannelId,
        categoryId: config.categoryId,
        roomsCategoryId: config.roomsCategoryId,
        controlChannelId: config.controlChannelId,
        defaultLimit: config.defaultLimit,
    };
}

function toChannelIdOrNull(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

app.get('/api/voice-settings', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    try {
        const config = await voice.getConfig();
        res.json(pickVoiceSettings(config));
    } catch (err) {
        console.error('dashboard: GET /api/voice-settings — не удалось прочитать конфиг:', err);
        res.status(500).json({ error: 'Не удалось загрузить настройки.' });
    }
});

app.put('/api/voice-settings', async (req, res) => {
    if (!(await isRequestSiteAdmin(req))) {
        res.status(403).json({ error: 'Нужны права администратора сервера бота.' });
        return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    try {
        await voice.updateConfig(cfg => {
            cfg.triggerChannelId = toChannelIdOrNull(body.triggerChannelId);
            cfg.categoryId = toChannelIdOrNull(body.categoryId);
            cfg.roomsCategoryId = toChannelIdOrNull(body.roomsCategoryId);
            cfg.controlChannelId = toChannelIdOrNull(body.controlChannelId);
            const limit = Number(body.defaultLimit);
            cfg.defaultLimit = Number.isFinite(limit) ? Math.min(99, Math.max(0, Math.round(limit))) : cfg.defaultLimit;
        });
        const saved = await voice.getConfig();
        res.json(pickVoiceSettings(saved));
    } catch (err) {
        console.error('dashboard: PUT /api/voice-settings — не удалось сохранить:', err);
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
