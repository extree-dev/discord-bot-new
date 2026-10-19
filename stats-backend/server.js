// Отдельный лёгкий бэкенд только для Riot Sign-On (RSO) у Extree Stats —
// вынесен из dashboard/server.js намеренно: Extree Stats независимый
// продукт (своя заявка в Riot Developer Portal, свой домен
// stats.extree.tech) — смешивать его сессии с личным кабинетом бота
// значило бы по коду связать два разных продукта. Образ переиспользует
// тот же Docker-образ, что бот/дашборд (docker-compose.yml, build: .,
// другой command) — у этого сервиса нет зависимостей сверх express/
// helmet/express-rate-limit, уже в package.json корня, заводить под три
// файла отдельный npm-пакет/Dockerfile было бы лишним (в отличие от
// stats-frontend/ — там принципиально другой тулинг, Vite/React/TS).
//
// RSO ещё не выдан Riot'ом (см. riotOAuth.js) — RIOT_CLIENT_ID/
// RIOT_CLIENT_SECRET пока не заданы нигде, и /auth/riot/login честно
// отвечает редиректом с ошибкой вместо похода в Riot с пустым client_id
// — тот же паттерн, что /auth/google/login в dashboard/server.js при
// незаданном GOOGLE_CLIENT_ID.
require('dotenv').config({ quiet: true });
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const riotOAuth = require('./riotOAuth');
const { encryptSession, decryptSession } = require('./session');

const PORT = process.env.STATS_BACKEND_PORT || 3000;
const RIOT_CLIENT_ID = process.env.RIOT_CLIENT_ID;
const RIOT_CLIENT_SECRET = process.env.RIOT_CLIENT_SECRET;
const SESSION_SECRET = process.env.STATS_SESSION_SECRET;

if (!SESSION_SECRET) {
    console.error('stats-backend: переменная окружения STATS_SESSION_SECRET не задана — процесс не может стартовать.');
    process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet());

const authRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(['/auth', '/api'], authRateLimiter);

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

app.use((req, _res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    next();
});

const SESSION_COOKIE = 'extree_stats_session';
const STATE_COOKIE = 'extree_stats_oauth_state';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// redirect_uri должен посимвольно совпадать на /authorize и на обмене
// кода — берём из Host запроса (тот же приём, что redirectUriFor в
// dashboard/server.js), хотя у Extree Stats сейчас только один домен —
// на случай www.stats.extree.tech или второго окружения в будущем.
function redirectUriFor(req) {
    return `https://${req.headers.host}/auth/riot/callback`;
}

function getSessionFromReq(req) {
    const raw = req.cookies[SESSION_COOKIE];
    return raw ? decryptSession(raw, SESSION_SECRET) : null;
}

app.get('/auth/riot/login', (req, res) => {
    if (!RIOT_CLIENT_ID) {
        res.redirect('/?auth_error=1');
        return;
    }
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
    });
    res.redirect(riotOAuth.buildAuthorizeUrl({ clientId: RIOT_CLIENT_ID, redirectUri: redirectUriFor(req), state }));
});

app.get('/auth/riot/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!RIOT_CLIENT_ID || !RIOT_CLIENT_SECRET || !code || !state || state !== req.cookies[STATE_COOKIE]) {
        res.redirect('/?auth_error=1');
        return;
    }
    res.clearCookie(STATE_COOKIE);
    try {
        const token = await riotOAuth.exchangeCode({
            clientId: RIOT_CLIENT_ID,
            clientSecret: RIOT_CLIENT_SECRET,
            redirectUri: redirectUriFor(req),
            code,
        });
        const identity = await riotOAuth.fetchIdentity(token.access_token);
        const session = encryptSession({ sub: identity.sub, issuedAt: Date.now() }, SESSION_SECRET);
        res.cookie(SESSION_COOKIE, session, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: SESSION_MAX_AGE_MS,
        });
        res.redirect('/');
    } catch (err) {
        console.error('stats-backend: ошибка обмена кода на токен Riot:', err);
        res.redirect('/?auth_error=1');
    }
});

app.get('/auth/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    res.redirect('/');
});

app.get('/api/session', (req, res) => {
    const session = getSessionFromReq(req);
    res.json({ user: session ? { sub: session.sub } : null });
});

app.listen(PORT, () => {
    console.log(`stats-backend: слушает порт ${PORT}`);
});
