// Связанные аккаунты дашборда: один внутренний id может быть достижим
// через Discord (обязательно — см. ниже), Telegram и/или email+пароль.
// Права всё равно проверяются только через discordId (см.
// discordOAuth.isGuildAdminById) — привязка Telegram/email не добавляет
// отдельную систему прав, а просто даёт другой способ попасть в тот же
// аккаунт, когда discord.com недоступен напрямую (блокировка и т.п.).
//
// Технически это означает: аккаунт всегда создаётся через Discord OAuth
// (findOrCreateByDiscordId) — обойти это нельзя и не нужно, иначе было бы
// неясно, кому вообще давать права. Telegram и email — только
// дополнительные двери к уже существующему аккаунту, привязываются,
// когда пользователь уже вошёл хотя бы раз через Discord.
const crypto = require('crypto');
const pgStore = require('../utils/pgStore');

const store = pgStore.createStore('dashboard_accounts', { accounts: [] }, raw => ({
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
}));

const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPasswordHash(password, stored) {
    if (!stored) return false;
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function newAccount(discordId) {
    return {
        id: crypto.randomUUID(),
        discordId,
        discordUsername: null,
        discordAvatar: null,
        telegramId: null,
        telegramUsername: null,
        googleId: null,
        googleEmail: null,
        email: null,
        passwordHash: null,
        createdAt: Date.now(),
    };
}

async function findById(accountId) {
    const { accounts } = await store.load();
    return accounts.find(a => a.id === accountId) ?? null;
}

async function findByTelegramId(telegramId) {
    const { accounts } = await store.load();
    return accounts.find(a => a.telegramId === telegramId) ?? null;
}

async function findByGoogleId(googleId) {
    const { accounts } = await store.load();
    return accounts.find(a => a.googleId === googleId) ?? null;
}

async function findByEmail(email) {
    const { accounts } = await store.load();
    return accounts.find(a => a.email === email) ?? null;
}

// Находит аккаунт по discordId или создаёт новый — вызывается на каждом
// успешном Discord OAuth-логине, заодно обновляет закэшированные
// username/avatar (нужны для /api/session без живого запроса к Discord
// при входах через Telegram/email).
async function findOrCreateByDiscordId(discordId, profile = {}) {
    return store.update(config => {
        let account = config.accounts.find(a => a.discordId === discordId);
        if (!account) {
            account = newAccount(discordId);
            config.accounts.push(account);
        }
        if (profile.username !== undefined) account.discordUsername = profile.username;
        if (profile.avatar !== undefined) account.discordAvatar = profile.avatar;
        return account;
    });
}

// Бросает 'telegram_already_linked', если этот Telegram уже привязан к
// другому аккаунту — вызывающий код (dashboard/server.js) превращает это
// в понятный ответ пользователю, а не падает 500-й.
async function linkTelegram(accountId, telegramId, telegramUsername) {
    return store.update(config => {
        const conflict = config.accounts.find(a => a.telegramId === telegramId && a.id !== accountId);
        if (conflict) throw new Error('telegram_already_linked');
        const account = config.accounts.find(a => a.id === accountId);
        if (!account) throw new Error('account_not_found');
        account.telegramId = telegramId;
        account.telegramUsername = telegramUsername ?? null;
        return account;
    });
}

// Бросает 'google_already_linked' при конфликте — та же логика, что у
// linkTelegram выше.
async function linkGoogle(accountId, googleId, googleEmail) {
    return store.update(config => {
        const conflict = config.accounts.find(a => a.googleId === googleId && a.id !== accountId);
        if (conflict) throw new Error('google_already_linked');
        const account = config.accounts.find(a => a.id === accountId);
        if (!account) throw new Error('account_not_found');
        account.googleId = googleId;
        account.googleEmail = googleEmail ?? null;
        return account;
    });
}

// Бросает 'email_already_used' при конфликте — та же логика, что у
// linkTelegram выше.
async function setPassword(accountId, email, password) {
    return store.update(config => {
        const conflict = config.accounts.find(a => a.email === email && a.id !== accountId);
        if (conflict) throw new Error('email_already_used');
        const account = config.accounts.find(a => a.id === accountId);
        if (!account) throw new Error('account_not_found');
        account.email = email;
        account.passwordHash = hashPassword(password);
        return account;
    });
}

async function verifyEmailLogin(email, password) {
    const account = await findByEmail(email);
    if (!account || !account.passwordHash) return null;
    return verifyPasswordHash(password, account.passwordHash) ? account : null;
}

module.exports = {
    storeName: store.name,
    findById,
    findByTelegramId,
    findByGoogleId,
    findByEmail,
    findOrCreateByDiscordId,
    linkTelegram,
    linkGoogle,
    setPassword,
    verifyEmailLogin,
    hashPassword,
    verifyPasswordHash,
};
