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
// Cloudflare Turnstile на /auth/login (turnstile.js) обходится без новой
// зависимости — встроенный fetch Node 18+, нужен только TURNSTILE_SECRET_KEY
// в .env (см. .env.example); публичный Site Key зашит прямо в код фронтенда.
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
const emailChangeCodes = require('./emailChangeCodes');
const loginCodes = require('./loginCodes');
const loginLocations = require('./loginLocations');
const loginEvents = require('./loginEvents');
const passwordResets = require('./passwordResets');
const supportTickets = require('./supportTickets');
const cannedResponses = require('./cannedResponses');
const geo = require('./geo');
const { verifyTurnstileToken } = require('./turnstile');
const mailer = require('./mailer');
const riotApi = require('./riotApi');
const {
    normalizeEmail,
    isValidEmail,
    isValidPassword,
    isValidName,
    isValidNickname,
    isValidSubject,
    isValidMessage,
    isValidCategory,
    parseRiotId,
} = require('./validation');

const PORT = process.env.STATS_BACKEND_PORT || 3000;
const RIOT_CLIENT_ID = process.env.RIOT_CLIENT_ID;
const RIOT_CLIENT_SECRET = process.env.RIOT_CLIENT_SECRET;
const SESSION_SECRET = process.env.STATS_SESSION_SECRET;

// Белый список email — тех же аккаунтов Extree Stats (email+пароль),
// кому доступна /admin/tickets. Нет отдельного понятия "роль" в
// stats_users ради одного админ-экрана — проще и быстрее завести список
// в .env (см. .env.example), чем тащить миграцию и UI управления ролями
// ради пары человек.
const SUPPORT_ADMIN_EMAILS = (process.env.SUPPORT_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

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

// Отдельный, более тесный лимит под поиск Riot ID — личный API-ключ Riot
// сам ограничен ~100 запросами/2 минуты на весь бэкенд, а authRateLimiter
// выше считает per-IP и этого не защищает: без этого частые обращения с
// разных IP всё равно могли бы выбить лимит самого ключа Riot.
const riotLookupRateLimiter = rateLimit({
    windowMs: 2 * 60 * 1000,
    limit: 80,
    standardHeaders: true,
    legacyHeaders: false,
});

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
// rememberMe=false — сессионная cookie без maxAge (браузер стирает её при
// закрытии), тот же подход, что у большинства сервисов для "не запоминать
// меня". Везде, кроме формы входа (RSO, верификация email, сброс пароля),
// rememberMe не передаётся и по умолчанию true — это не места, где у
// пользователя стоял выбор, нет причин внезапно укорачивать сессию.
function setSessionCookie(res, payload, rememberMe = true) {
    res.cookie(SESSION_COOKIE, encryptSession({ ...payload, issuedAt: Date.now() }, SESSION_SECRET), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        ...(rememberMe ? { maxAge: SESSION_MAX_AGE_MS } : {}),
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
    const ip = geo.getClientIp(req);
    // Молчаливый флаг, не ошибка валидации: отсутствующее поле (старый
    // клиент, прямой curl) тоже значит "запомнить", как было до чекбокса.
    const rememberMe = req.body?.rememberMe !== false;

    // Проверяем Turnstile раньше всего остального — смысл капчи в том,
    // чтобы отсекать ботов/перебор credential stuffing до того, как мы
    // вообще обратимся к БД или сравним хеш пароля, а не после.
    if (!(await verifyTurnstileToken(req.body?.turnstileToken, ip))) {
        res.status(400).json({ error: 'turnstile_failed' });
        return;
    }

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
            await issueAndSendLoginCode(email, { ip, country, city, remember: rememberMe });
        } catch (err) {
            console.error('stats-backend: ошибка отправки кода подтверждения нового места входа:', err);
            res.status(500).json({ error: 'internal_error' });
            return;
        }
        res.status(403).json({ error: 'unknown_location' });
        return;
    }

    await loginLocations.rememberLocation(user.id, country, city, ip);
    await loginEvents.recordLogin(user.id, { ip, country, city });
    try {
        await mailer.sendSignInNotification(email, { ip, country, city, time: new Date().toUTCString() });
    } catch (err) {
        // Уведомление — не критично для самого входа: не роняем сессию
        // из-за временной проблемы с почтой.
        console.error('stats-backend: ошибка отправки уведомления о входе:', err);
    }

    setSessionCookie(res, { userId: user.id }, rememberMe);
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
        await issueAndSendLoginCode(email, {
            ip: pending.ip,
            country: pending.country,
            city: pending.city,
            remember: pending.remember,
        });
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
    await loginEvents.recordLogin(user.id, { ip: row.ip, country: row.country, city: row.city });
    await loginCodes.deleteCode(email);

    setSessionCookie(res, { userId: user.id }, row.remember);
    res.json({ ok: true, user: { email: user.email } });
});

function resetUrlFor(req, token) {
    return `https://${req.headers.host}/reset-password?token=${token}`;
}

function ticketUrlFor(req, token) {
    return `https://${req.headers.host}/support/ticket/${token}`;
}

function adminTicketUrlFor(req, ticketNumber) {
    return `https://${req.headers.host}/admin/tickets/${ticketNumber}`;
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

    const resetIp = geo.getClientIp(req);
    const resetLocation = geo.lookupLocation(resetIp);
    await loginEvents.recordLogin(user.id, { ip: resetIp, ...resetLocation });
    try {
        await mailer.sendPasswordChanged(user.email, {
            ip: resetIp,
            ...resetLocation,
            time: new Date().toUTCString(),
        });
    } catch (err) {
        // Уведомление — не критично для самого сброса: не роняем вход
        // из-за временной проблемы с почтой.
        console.error('stats-backend: ошибка отправки уведомления о смене пароля:', err);
    }

    // Успешный сброс — это тоже вход: пускаем сразу в аккаунт, не
    // заставляя повторно вводить новый пароль на /login.
    setSessionCookie(res, { userId: user.id });
    res.json({ ok: true, user: { email: user.email } });
});

// Смена email/пароля из настроек аккаунта — отличается от /auth/reset-
// password (та для "забыл пароль", без знания текущего): обе требуют
// действующую сессию И текущий пароль ("step-up" проверка, тот же приём,
// что у крупных сервисов — простого факта быть залогиненным недостаточно
// для смены учётных данных).
function requireSession(req, res) {
    const session = getSessionFromReq(req);
    if (!session?.userId) {
        res.status(401).json({ error: 'unauthorized' });
        return null;
    }
    return session;
}

// Тикет-админка (/api/admin/tickets/*) — та же сессия, что и остальной
// аккаунт, плюс email в SUPPORT_ADMIN_EMAILS. 401 (не вошёл) и 403 (вошёл,
// но не в списке) различаем — фронту это не нужно сейчас, но так честнее
// в логах/devtools, чем притворяться, что эндпоинта вовсе нет.
async function requireAdmin(req, res) {
    const session = requireSession(req, res);
    if (!session) return null;
    const user = await users.findById(session.userId);
    if (!user || !SUPPORT_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        res.status(403).json({ error: 'forbidden' });
        return null;
    }
    return user;
}

app.post('/auth/account/change-email', async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const currentPassword = req.body?.currentPassword;
    const newEmail = normalizeEmail(req.body?.newEmail);

    if (!isValidEmail(newEmail)) {
        res.status(400).json({ error: 'invalid_email' });
        return;
    }

    const user = await users.findById(session.userId);
    if (!user || !users.verifyPasswordHash(currentPassword, user.password_hash)) {
        res.status(401).json({ error: 'wrong_password' });
        return;
    }
    if (newEmail === user.email) {
        res.status(400).json({ error: 'same_email' });
        return;
    }
    const existing = await users.findByEmail(newEmail);
    if (existing) {
        res.status(409).json({ error: 'email_already_registered' });
        return;
    }
    if (await emailChangeCodes.isOnCooldown(session.userId)) {
        res.status(429).json({ error: 'code_on_cooldown' });
        return;
    }

    try {
        const code = emailChangeCodes.generateCode();
        await emailChangeCodes.upsertCode(session.userId, newEmail, code);
        await mailer.sendEmailChangeCode(newEmail, { code });
        try {
            await mailer.sendEmailChangeNotice(user.email, { newEmail });
        } catch (err) {
            // Уведомление на старый адрес — не критично для самого запроса
            // смены: не роняем его из-за временной проблемы с почтой.
            console.error('stats-backend: ошибка отправки уведомления о запросе смены email:', err);
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('stats-backend: ошибка запроса смены email:', err);
        res.status(500).json({ error: 'internal_error' });
    }
});

app.post('/auth/account/resend-email-change-code', async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const pending = await emailChangeCodes.getCode(session.userId);
    if (!pending) {
        res.status(400).json({ error: 'no_pending_change' });
        return;
    }
    if (await emailChangeCodes.isOnCooldown(session.userId)) {
        res.status(429).json({ error: 'code_on_cooldown' });
        return;
    }

    try {
        const code = emailChangeCodes.generateCode();
        await emailChangeCodes.upsertCode(session.userId, pending.new_email, code);
        await mailer.sendEmailChangeCode(pending.new_email, { code });
        res.json({ ok: true });
    } catch (err) {
        console.error('stats-backend: ошибка повторной отправки кода смены email:', err);
        res.status(500).json({ error: 'internal_error' });
    }
});

app.post('/auth/account/confirm-email-change', async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!code) {
        res.status(400).json({ error: 'invalid_request' });
        return;
    }

    const row = await emailChangeCodes.getCode(session.userId);
    if (!row) {
        res.status(400).json({ error: 'code_not_found' });
        return;
    }
    if (Date.now() > new Date(row.expires_at).getTime()) {
        await emailChangeCodes.deleteCode(session.userId);
        res.status(400).json({ error: 'code_expired' });
        return;
    }
    if (row.attempts >= emailChangeCodes.MAX_ATTEMPTS) {
        res.status(429).json({ error: 'too_many_attempts' });
        return;
    }
    if (code !== row.code) {
        await emailChangeCodes.registerFailedAttempt(session.userId);
        res.status(400).json({ error: 'wrong_code' });
        return;
    }

    // Второй игрок мог занять этот email между запросом смены и
    // подтверждением кода — перепроверяем прямо перед записью.
    const conflicting = await users.findByEmail(row.new_email);
    if (conflicting && conflicting.id !== session.userId) {
        await emailChangeCodes.deleteCode(session.userId);
        res.status(409).json({ error: 'email_already_registered' });
        return;
    }

    const before = await users.findById(session.userId);
    const updated = await users.updateEmail(session.userId, row.new_email);
    await emailChangeCodes.deleteCode(session.userId);
    if (!updated || !before) {
        res.status(500).json({ error: 'internal_error' });
        return;
    }

    try {
        await Promise.all([
            mailer.sendEmailChanged(before.email, { oldEmail: before.email, newEmail: updated.email }),
            mailer.sendEmailChanged(updated.email, { oldEmail: before.email, newEmail: updated.email }),
        ]);
    } catch (err) {
        console.error('stats-backend: ошибка отправки подтверждения смены email:', err);
    }

    res.json({ ok: true, user: { email: updated.email } });
});

app.post('/auth/account/change-password', async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const currentPassword = req.body?.currentPassword;
    const newPassword = req.body?.newPassword;

    if (!isValidPassword(newPassword)) {
        res.status(400).json({ error: 'invalid_password' });
        return;
    }

    const user = await users.findById(session.userId);
    if (!user || !users.verifyPasswordHash(currentPassword, user.password_hash)) {
        res.status(401).json({ error: 'wrong_password' });
        return;
    }

    const updated = await users.updatePasswordHash(session.userId, users.hashPassword(newPassword));
    if (!updated) {
        res.status(500).json({ error: 'internal_error' });
        return;
    }

    try {
        const ip = geo.getClientIp(req);
        await mailer.sendPasswordChanged(updated.email, {
            ip,
            ...geo.lookupLocation(ip),
            time: new Date().toUTCString(),
        });
    } catch (err) {
        console.error('stats-backend: ошибка отправки уведомления о смене пароля:', err);
    }

    res.json({ ok: true });
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
            // Фронт использует это только чтобы решить, показывать ли ссылку
            // "Tickets" в меню аккаунта — реальная проверка прав всё равно
            // на requireAdmin у каждого /api/admin/* эндпоинта (см. выше),
            // это поле не открывает доступ само по себе.
            isAdmin: SUPPORT_ADMIN_EMAILS.includes(user.email.toLowerCase()),
        },
    });
});

app.get('/api/account/login-history', async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const events = await loginEvents.listRecent(session.userId);
    res.json({
        events: events.map(e => ({
            id: e.id,
            ip: e.ip,
            country: e.country,
            city: e.city,
            time: new Date(e.created_at).toUTCString(),
        })),
    });
});

// Заявка в поддержку — доступна без входа (см. обсуждение при добавлении:
// именно тот, кто не может войти, чаще всего и обращается в поддержку).
// Если сессия есть, email берём из аккаунта и игнорируем тот, что прислали
// в теле — не даём залогиненному пользователю притвориться другим
// отправителем; без сессии email обязателен и валидируется как обычно.
app.post('/api/support/tickets', async (req, res) => {
    const session = getSessionFromReq(req);
    let userId = null;
    let email;

    if (session?.userId) {
        const user = await users.findById(session.userId);
        if (!user) {
            res.status(401).json({ error: 'invalid_request' });
            return;
        }
        userId = user.id;
        email = user.email;
    } else {
        email = normalizeEmail(req.body?.email);
        if (!isValidEmail(email)) {
            res.status(400).json({ error: 'invalid_email' });
            return;
        }
    }

    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';

    if (!isValidSubject(subject)) {
        res.status(400).json({ error: 'invalid_subject' });
        return;
    }
    if (!isValidMessage(message)) {
        res.status(400).json({ error: 'invalid_message' });
        return;
    }
    if (!isValidCategory(category)) {
        res.status(400).json({ error: 'invalid_category' });
        return;
    }
    if (await supportTickets.isOnCooldown(email)) {
        res.status(429).json({ error: 'code_on_cooldown' });
        return;
    }

    try {
        const ticket = await supportTickets.createTicket({ userId, email, subject, message, category });
        const ticketUrl = ticketUrlFor(req, ticket.viewToken);
        await mailer.sendSupportTicketConfirmation(email, { ticketNumber: ticket.ticketNumber, subject, ticketUrl });
        try {
            await mailer.sendSupportTicketNotification({
                ticketNumber: ticket.ticketNumber,
                email,
                subject,
                message,
                category,
                userId,
                adminUrl: adminTicketUrlFor(req, ticket.ticketNumber),
            });
        } catch (err) {
            // Письмо в поддержку — не критично для самого факта подачи
            // заявки (она уже сохранена в БД): не роняем ответ пользователю
            // из-за временной проблемы с почтой.
            console.error('stats-backend: ошибка отправки уведомления команде поддержки:', err);
        }
        res.json({ ok: true, ticketNumber: ticket.ticketNumber });
    } catch (err) {
        console.error('stats-backend: ошибка создания заявки в поддержку:', err);
        res.status(500).json({ error: 'internal_error' });
    }
});

const TICKET_STATUSES = ['open', 'in_progress', 'closed'];

// Админка тикетов (/admin/tickets) — список и ответ живут на сайте вместо
// переписки по почте (см. обсуждение при добавлении: доступа к реальному
// почтовому ящику support@extree.tech со своим отдельным логином нет и не
// планируется, письма — только уведомления со ссылкой сюда). Адресуются
// по ticket_number (человекочитаемый #42, см. db.js), не по внутреннему
// UUID id — он только в БД, наружу (URL, письма) не торчит.
app.get('/api/admin/tickets', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    if (status && !TICKET_STATUSES.includes(status)) {
        res.status(400).json({ error: 'invalid_request' });
        return;
    }
    const tickets = await supportTickets.listTickets({ status });
    res.json({
        tickets: tickets.map(t => ({
            number: Number(t.ticket_number),
            email: t.email,
            subject: t.subject,
            category: t.category,
            status: t.status,
            time: new Date(t.created_at).toUTCString(),
        })),
    });
});

app.get('/api/admin/tickets/:number', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const ticket = await supportTickets.getTicketByNumber(req.params.number);
    if (!ticket) {
        res.status(404).json({ error: 'ticket_not_found' });
        return;
    }
    const replies = await supportTickets.listReplies(ticket.id);
    res.json({
        ticket: {
            number: Number(ticket.ticket_number),
            email: ticket.email,
            subject: ticket.subject,
            message: ticket.message,
            category: ticket.category,
            status: ticket.status,
            time: new Date(ticket.created_at).toUTCString(),
        },
        replies: replies.map(r => ({
            id: r.id,
            author: r.author,
            message: r.message,
            time: new Date(r.created_at).toUTCString(),
        })),
    });
});

app.post('/api/admin/tickets/:number/reply', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!isValidMessage(message)) {
        res.status(400).json({ error: 'invalid_message' });
        return;
    }

    const ticket = await supportTickets.getTicketByNumber(req.params.number);
    if (!ticket) {
        res.status(404).json({ error: 'ticket_not_found' });
        return;
    }

    try {
        await supportTickets.addReply(ticket.id, 'admin', message);
        // Первый ответ админа сдвигает тикет из "open" в "in_progress" —
        // то же поведение, что у большинства тикет-систем: "открыт" значит
        // "ещё не взяли в работу", а не "ждём ответа команды". Если статус
        // уже меняли вручную (in_progress/closed), не трогаем его здесь.
        if (ticket.status === 'open') {
            await supportTickets.setStatus(ticket.id, 'in_progress');
        }
    } catch (err) {
        console.error('stats-backend: ошибка ответа на тикет из админки:', err);
        res.status(500).json({ error: 'internal_error' });
        return;
    }
    try {
        await mailer.sendSupportTicketReply(ticket.email, {
            ticketNumber: ticket.ticket_number,
            subject: ticket.subject,
            message,
            adminName: admin.name,
            ticketUrl: ticketUrlFor(req, ticket.view_token),
        });
    } catch (err) {
        // Ответ уже сохранён и виден в треде — сбой письма-уведомления не
        // повод говорить админу, что ответ не отправился.
        console.error('stats-backend: ошибка отправки уведомления об ответе на тикет:', err);
    }
    res.json({ ok: true });
});

app.post('/api/admin/tickets/:number/status', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const status = req.body?.status;
    if (!TICKET_STATUSES.includes(status)) {
        res.status(400).json({ error: 'invalid_request' });
        return;
    }

    const ticket = await supportTickets.getTicketByNumber(req.params.number);
    if (!ticket) {
        res.status(404).json({ error: 'ticket_not_found' });
        return;
    }

    await supportTickets.setStatus(ticket.id, status);
    res.json({ ok: true });
});

// Готовые ответы ("macros") для админки — см. cannedResponses.js.
app.get('/api/admin/canned-responses', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const responses = await cannedResponses.listCannedResponses();
    res.json({ responses });
});

app.post('/api/admin/canned-responses', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (!isValidSubject(title)) {
        res.status(400).json({ error: 'invalid_subject' });
        return;
    }
    if (!isValidMessage(body)) {
        res.status(400).json({ error: 'invalid_message' });
        return;
    }

    const created = await cannedResponses.createCannedResponse(title, body);
    res.json({ ok: true, id: created.id });
});

app.delete('/api/admin/canned-responses/:id', async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    await cannedResponses.deleteCannedResponse(req.params.id);
    res.json({ ok: true });
});

// Просмотр/ответ на свой тикет без входа — по секретному view_token из
// письма-подтверждения (см. supportTickets.js), не по ticket_number: тот
// просто инкремент и легко перебирается, по нему нельзя пускать в чужой
// тред.
app.get('/api/support/tickets/:token', async (req, res) => {
    const ticket = await supportTickets.getTicketByToken(req.params.token);
    if (!ticket) {
        res.status(404).json({ error: 'ticket_not_found' });
        return;
    }
    const replies = await supportTickets.listReplies(ticket.id);
    res.json({
        ticket: {
            number: Number(ticket.ticket_number),
            subject: ticket.subject,
            message: ticket.message,
            status: ticket.status,
            time: new Date(ticket.created_at).toUTCString(),
        },
        replies: replies.map(r => ({
            id: r.id,
            author: r.author,
            message: r.message,
            time: new Date(r.created_at).toUTCString(),
        })),
    });
});

app.post('/api/support/tickets/:token/reply', async (req, res) => {
    const ticket = await supportTickets.getTicketByToken(req.params.token);
    if (!ticket) {
        res.status(404).json({ error: 'ticket_not_found' });
        return;
    }
    if (ticket.status === 'closed') {
        res.status(409).json({ error: 'ticket_closed' });
        return;
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!isValidMessage(message)) {
        res.status(400).json({ error: 'invalid_message' });
        return;
    }
    if (await supportTickets.isReplyOnCooldown(ticket.id)) {
        res.status(429).json({ error: 'code_on_cooldown' });
        return;
    }

    try {
        await supportTickets.addReply(ticket.id, 'user', message);
    } catch (err) {
        console.error('stats-backend: ошибка ответа пользователя в тикете:', err);
        res.status(500).json({ error: 'internal_error' });
        return;
    }
    try {
        await mailer.sendSupportTicketUserReply({
            ticketNumber: ticket.ticket_number,
            email: ticket.email,
            subject: ticket.subject,
            message,
            adminUrl: adminTicketUrlFor(req, ticket.ticket_number),
        });
    } catch (err) {
        // Ответ уже сохранён и виден в треде — сбой письма-уведомления не
        // повод говорить пользователю, что его ответ не отправился.
        console.error('stats-backend: ошибка отправки уведомления команде поддержки об ответе:', err);
    }
    res.json({ ok: true });
});

// Поиск Riot-аккаунта по Riot ID ("Имя#Тег") — только подтверждение, что
// аккаунт существует (account-v1). Полноценная статистика матчей (K/D,
// карты, винрейт) пока недоступна — см. riotApi.js: VALORANT Match-V1
// этому ключу не отдан, Riot требует для него отдельно одобренный продукт
// + RSO-согласие игрока.
app.post('/api/riot/lookup', riotLookupRateLimiter, async (req, res) => {
    const parsed = parseRiotId(typeof req.body?.riotId === 'string' ? req.body.riotId : '');
    if (!parsed) {
        res.status(400).json({ error: 'invalid_riot_id' });
        return;
    }

    try {
        const result = await riotApi.lookupRiotAccount(parsed.gameName, parsed.tagLine);
        if (!result.configured) {
            res.status(503).json({ error: 'riot_api_not_configured' });
            return;
        }
        if (!result.found) {
            res.status(404).json({ error: 'riot_account_not_found' });
            return;
        }
        res.json({ ok: true, gameName: result.gameName, tagLine: result.tagLine });
    } catch (err) {
        console.error('stats-backend: ошибка поиска Riot-аккаунта:', err);
        res.status(502).json({ error: 'riot_api_error' });
    }
});

app.listen(PORT, () => {
    console.log(`stats-backend: слушает порт ${PORT}`);
});
