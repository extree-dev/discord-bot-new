// Бэкенд Extree Stats — RSO-логин (Riot Sign-On) и собственная система
// аккаунтов (email + пароль, db.js/users.js/emailCodes.js/mailer.js) —
// вынесен из dashboard/server.js намеренно: Extree Stats независимый
// продукт (своя заявка в Riot Developer Portal, свой домен
// stats.extree.tech) — смешивать его сессии/данные с личным кабинетом
// бота значило бы по коду связать два разных продукта. Образ
// переиспользует тот же Docker-образ, что бот/дашборд (docker-
// compose.yml, build: ., другой command); зависимости сверх корневого
// package.json — pg (та же БД, что у бота, но свои таблицы, см. db.js)
// и nodemailer (своя почта под Extree Stats, не Resend бота).
//
// RSO ещё не выдан Riot'ом (см. riotOAuth.js) — RIOT_CLIENT_ID/
// RIOT_CLIENT_SECRET пока не заданы нигде, и /auth/riot/login честно
// отвечает редиректом с ошибкой вместо похода в Riot с пустым client_id
// — тот же паттерн, что /auth/google/login в dashboard/server.js при
// незаданном GOOGLE_CLIENT_ID. Пока RSO недоступен, email+пароль —
// единственный способ завести аккаунт.
require('dotenv').config({ quiet: true });
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const riotOAuth = require('./riotOAuth');
const { encryptSession, decryptSession } = require('./session');
const users = require('./users');
const emailCodes = require('./emailCodes');
const mailer = require('./mailer');
const { normalizeEmail, isValidEmail, isValidPassword } = require('./validation');

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
app.use(express.json({ limit: '10kb' }));

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

// Общий для RSO-логина и email+пароль-логина — оба в итоге просто кладут
// в одну и ту же cookie зашифрованный payload, разной формы ({sub, ...}
// для Riot, {userId, ...} для email-аккаунта); /api/account/me и
// /api/session читают из неё то поле, которое им нужно.
function setSessionCookie(res, payload) {
    res.cookie(SESSION_COOKIE, encryptSession({ ...payload, issuedAt: Date.now() }, SESSION_SECRET), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE_MS,
    });
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
        setSessionCookie(res, { sub: identity.sub });
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

// Регистрация email+паролем — отдельная от RSO система входа (см. PR,
// добавляющий этот блок): пока Riot не одобрил продукт и RSO недоступен,
// это единственный способ завести аккаунт. riot_puuid в схеме уже есть
// (db.js) — привязка Riot-профиля к уже созданному аккаунту планируется
// отдельной функцией позже, этот эндпоинт её не трогает.
async function issueAndSendCode(email) {
    const code = emailCodes.generateCode();
    await emailCodes.upsertCode(email, code);
    await mailer.sendVerificationCode(email, code);
}

app.post('/auth/register', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!isValidEmail(email)) {
        res.status(400).json({ error: 'invalid_email' });
        return;
    }
    if (!isValidPassword(password)) {
        res.status(400).json({ error: 'invalid_password' });
        return;
    }

    const existing = await users.findByEmail(email);
    if (existing?.email_verified_at) {
        res.status(409).json({ error: 'email_already_registered' });
        return;
    }
    if (await emailCodes.isOnCooldown(email)) {
        res.status(429).json({ error: 'code_on_cooldown' });
        return;
    }

    try {
        // Существующий, но ещё не подтверждённый аккаунт — перезаписываем
        // пароль (пользователь мог опечататься в первой попытке) и шлём
        // новый код, не создавая дубликат.
        await users.upsertUnverifiedUser(email, users.hashPassword(password));
        await issueAndSendCode(email);
        res.json({ ok: true });
    } catch (err) {
        console.error('stats-backend: ошибка регистрации:', err);
        res.status(500).json({ error: 'internal_error' });
    }
});

app.post('/auth/resend-code', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
        res.status(400).json({ error: 'invalid_email' });
        return;
    }

    const existing = await users.findByEmail(email);
    if (!existing || existing.email_verified_at) {
        // Не сообщаем, зарегистрирован ли email и подтверждён ли он —
        // чтобы по ответу нельзя было перебором узнавать чужие email.
        res.json({ ok: true });
        return;
    }
    if (await emailCodes.isOnCooldown(email)) {
        res.status(429).json({ error: 'code_on_cooldown' });
        return;
    }

    try {
        await issueAndSendCode(email);
        res.json({ ok: true });
    } catch (err) {
        console.error('stats-backend: ошибка повторной отправки кода:', err);
        res.status(500).json({ error: 'internal_error' });
    }
});

app.post('/auth/verify', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

    if (!isValidEmail(email) || !code) {
        res.status(400).json({ error: 'invalid_request' });
        return;
    }

    const row = await emailCodes.getCode(email);
    if (!row) {
        res.status(400).json({ error: 'code_not_found' });
        return;
    }
    if (Date.now() > new Date(row.expires_at).getTime()) {
        await emailCodes.deleteCode(email);
        res.status(400).json({ error: 'code_expired' });
        return;
    }
    if (row.attempts >= emailCodes.MAX_ATTEMPTS) {
        res.status(429).json({ error: 'too_many_attempts' });
        return;
    }
    if (code !== row.code) {
        await emailCodes.registerFailedAttempt(email);
        res.status(400).json({ error: 'wrong_code' });
        return;
    }

    const user = await users.markEmailVerified(email);
    await emailCodes.deleteCode(email);
    if (!user) {
        res.status(500).json({ error: 'internal_error' });
        return;
    }

    setSessionCookie(res, { userId: user.id });
    res.json({ ok: true, user: { email: user.email } });
});

app.post('/auth/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!isValidEmail(email) || typeof password !== 'string') {
        res.status(400).json({ error: 'invalid_request' });
        return;
    }

    const user = await users.findByEmail(email);
    if (!user || !users.verifyPasswordHash(password, user.password_hash)) {
        res.status(401).json({ error: 'invalid_credentials' });
        return;
    }
    if (!user.email_verified_at) {
        res.status(403).json({ error: 'email_not_verified' });
        return;
    }

    setSessionCookie(res, { userId: user.id });
    res.json({ ok: true, user: { email: user.email } });
});

app.get('/api/account/me', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session?.userId) {
        res.json({ user: null });
        return;
    }
    const user = await users.findById(session.userId);
    if (!user) {
        res.json({ user: null });
        return;
    }
    res.json({
        user: {
            email: user.email,
            emailVerified: Boolean(user.email_verified_at),
            riotLinked: Boolean(user.riot_puuid),
        },
    });
});

app.listen(PORT, () => {
    console.log(`stats-backend: слушает порт ${PORT}`);
});
