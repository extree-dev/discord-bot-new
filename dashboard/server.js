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
const security = require('../security/config');
const presence = require('../presence');
const voice = require('../voice');

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

// "Администратор домена" = Administrator/владелец на сервере бота
// (GUILD_ID) — единый гейт для всего, что можно менять с сайта
// (визитка, настройки безопасности и дальше): /api/site-admin-status,
// PUT /api/site-content, GET/PUT /api/security-settings.
async function isRequestSiteAdmin(req) {
    const session = getSessionFromReq(req);
    if (!session) return false;
    try {
        const userGuilds = await oauth.fetchUserGuilds(session.accessToken);
        return oauth.isSiteAdmin(userGuilds, GUILD_ID);
    } catch (err) {
        console.error('dashboard: не удалось проверить права администратора:', err);
        return false;
    }
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
