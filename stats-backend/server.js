// Бэкенд Extree Stats — RSO-логин (Riot Sign-On) и собственная система
// аккаунтов (email + пароль, db.js/users.js/emailCodes.js/mailer.js) —
// вынесен из dashboard/server.js намеренно: Extree Stats независимый
// продукт (своя заявка в Riot Developer Portal, свой домен
// stats.extree.tech) — смешивать его сессии/данные с личным кабинетом
// бота значило бы по коду связать два разных продукта. Образ
// переиспользует тот же Docker-образ, что бот/дашборд (docker-
// compose.yml, build: ., другой command); зависимости сверх корневого
// package.json — pg (та же БД, что у бота, но свои таблицы, см. db.js),
// nodemailer (своя почта под Extree Stats, не Resend бота) и geoip-lite
// (офлайн-геолокация по IP для /auth/login — см. geo.js/loginLocations.js).
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
const loginCodes = require('./loginCodes');
const loginLocations = require('./loginLocations');
const passwordResets = require('./passwordResets');
const geo = require('./geo');
const mailer = require('./mailer');
const { normalizeEmail, isValidEmail, isValidPassword, isValidName, isValidNickname } = require('./validation');

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
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const nickname = typeof req.body?.nickname === 'string' ? req.body.nickname.trim() : '';

    if (!isValidEmail(email)) {
        res.status(400).json({ error: 'invalid_email' });
        return;
    }
    if (!isValidPassword(password)) {
        res.status(400).json({ error: 'invalid_password' });
        return;
    }
    if (!isValidName(name)) {
        res.status(400).json({ error: 'invalid_name' });
        return;
    }
    if (!isValidNickname(nickname)) {
        res.status(400).json({ error: 'invalid_nickname' });
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
        // пароль/имя/никнейм (пользователь мог опечататься в первой
        // попытке) и шлём новый код, не создавая дубликат.
        await users.upsertUnverifiedUser(email, users.hashPassword(password), { name, nickname });
        await issueAndSendCode(email);
        res.json({ ok: true });
    } catch (err) {
        // UNIQUE(nickname) занят кем-то другим — единственное ограничение
        // схемы, которое реально может сработать здесь (email проверен
        // выше через findByEmail).
        if (err.code === '23505' && err.constraint === 'stats_users_nickname_key') {
            res.status(409).json({ error: 'nickname_taken' });
            return;
        }
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

    // Регистрация — это ещё не "вход" в смысле /auth/login (письма о входе
    // тут не шлём, см. mailer.sendSignInNotification), но именно здесь
    // появляется первое "известное место" для аккаунта, чтобы следующий
    // реальный /auth/login с того же места прошёл без доп. подтверждения.
    const ip = geo.getClientIp(req);
    const { country, city } = geo.lookupLocation(ip);
    await loginLocations.rememberLocation(user.id, country, city, ip);

    setSessionCookie(res, { userId: user.id });
    res.json({ ok: true, user: { email: user.email } });
});

async function issueAndSendLoginCode(email, location) {
    const code = loginCodes.generateCode();
    await loginCodes.upsertCode(email, code, location);
    await mailer.sendNewLocationCode(email, code, location);
}

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

    const ip = geo.getClientIp(req);
    const { country, city } = geo.lookupLocation(ip);

    // Блокируем вход только когда для аккаунта УЖЕ есть хотя бы одно
    // известное место И текущая страна определена и не совпадает ни с
    // одним известным — иначе легитимный владелец никогда бы не смог
    // войти в первый раз, а пробел в офлайн-базе геолокации не должен
    // запирать аккаунт (см. loginLocations.isKnownLocation).
    const hasHistory = await loginLocations.hasAnyKnownLocation(user.id);
    const known = await loginLocations.isKnownLocation(user.id, country);

    if (hasHistory && !known) {
        if (await loginCodes.isOnCooldown(email)) {
            res.status(429).json({ error: 'code_on_cooldown' });
            return;
        }
        try {
            await issueAndSendLoginCode(email, { ip, country, city });
        } catch (err) {
            console.error('stats-backend: ошибка отправки кода подтверждения нового места входа:', err);
            res.status(500).json({ error: 'internal_error' });
            return;
        }
        res.status(403).json({ error: 'unknown_location' });
        return;
    }

    await loginLocations.rememberLocation(user.id, country, city, ip);
    try {
        await mailer.sendSignInNotification(email, { ip, country, city, time: new Date().toUTCString() });
    } catch (err) {
        // Уведомление — не критично для самого входа: не роняем сессию
        // из-за временной проблемы с почтой.
        console.error('stats-backend: ошибка отправки уведомления о входе:', err);
    }

    setSessionCookie(res, { userId: user.id });
    res.json({ ok: true, user: { email: user.email } });
});

app.post('/auth/login/resend-code', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
        res.status(400).json({ error: 'invalid_email' });
        return;
    }

    const pending = await loginCodes.getCode(email);
    if (!pending) {
        // Не сообщаем, есть ли вообще ожидающий подтверждения вход для
        // этого email — тот же приём, что /auth/resend-code.
        res.json({ ok: true });
        return;
    }
    if (await loginCodes.isOnCooldown(email)) {
        res.status(429).json({ error: 'code_on_cooldown' });
        return;
    }

    try {
        await issueAndSendLoginCode(email, { ip: pending.ip, country: pending.country, city: pending.city });
        res.json({ ok: true });
    } catch (err) {
        console.error('stats-backend: ошибка повторной отправки кода подтверждения входа:', err);
        res.status(500).json({ error: 'internal_error' });
    }
});

app.post('/auth/login/confirm-location', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

    if (!isValidEmail(email) || !code) {
        res.status(400).json({ error: 'invalid_request' });
        return;
    }

    const row = await loginCodes.getCode(email);
    if (!row) {
        res.status(400).json({ error: 'code_not_found' });
        return;
    }
    if (Date.now() > new Date(row.expires_at).getTime()) {
        await loginCodes.deleteCode(email);
        res.status(400).json({ error: 'code_expired' });
        return;
    }
    if (row.attempts >= loginCodes.MAX_ATTEMPTS) {
        res.status(429).json({ error: 'too_many_attempts' });
        return;
    }
    if (code !== row.code) {
        await loginCodes.registerFailedAttempt(email);
        res.status(400).json({ error: 'wrong_code' });
        return;
    }

    const user = await users.findByEmail(email);
    if (!user) {
        res.status(500).json({ error: 'internal_error' });
        return;
    }

    // Доверяем месту из исходной попытки входа (row), а не текущему
    // запросу — его могут подтверждать с другого устройства/сети.
    await loginLocations.rememberLocation(user.id, row.country, row.city, row.ip);
    await loginCodes.deleteCode(email);

    setSessionCookie(res, { userId: user.id });
    res.json({ ok: true, user: { email: user.email } });
});

function resetUrlFor(req, token) {
    return `https://${req.headers.host}/reset-password?token=${token}`;
}

app.post('/auth/forgot-password', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
        res.status(400).json({ error: 'invalid_email' });
        return;
    }

    if (await passwordResets.isOnCooldown(email)) {
        res.status(429).json({ error: 'code_on_cooldown' });
        return;
    }

    // Один и тот же ответ независимо от того, существует ли аккаунт —
    // тот же приём анти-перебора, что /auth/resend-code и
    // /auth/login/resend-code: по ответу нельзя узнать, зарегистрирован
    // ли email.
    const user = await users.findByEmail(email);
    if (user) {
        try {
            const token = await passwordResets.createReset(user.id, email);
            await mailer.sendPasswordResetEmail(email, resetUrlFor(req, token));
        } catch (err) {
            console.error('stats-backend: ошибка отправки письма сброса пароля:', err);
        }
    }
    res.json({ ok: true });
});

app.post('/auth/reset-password', async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const password = req.body?.password;

    if (!token) {
        res.status(400).json({ error: 'invalid_request' });
        return;
    }
    if (!isValidPassword(password)) {
        res.status(400).json({ error: 'invalid_password' });
        return;
    }

    const row = await passwordResets.getReset(token);
    if (!row) {
        res.status(400).json({ error: 'token_not_found' });
        return;
    }
    if (Date.now() > new Date(row.expires_at).getTime()) {
        await passwordResets.deleteReset(token);
        res.status(400).json({ error: 'token_expired' });
        return;
    }

    const user = await users.updatePasswordHash(row.user_id, users.hashPassword(password));
    await passwordResets.deleteReset(token);
    if (!user) {
        res.status(500).json({ error: 'internal_error' });
        return;
    }

    // Успешный сброс — это тоже вход: пускаем сразу в аккаунт, не
    // заставляя повторно вводить новый пароль на /login.
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
            name: user.name,
            nickname: user.nickname,
        },
    });
});

app.listen(PORT, () => {
    console.log(`stats-backend: слушает порт ${PORT}`);
});
