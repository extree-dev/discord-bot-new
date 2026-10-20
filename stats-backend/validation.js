// Общие проверки для /auth/register, /auth/login и /auth/reset-password —
// вынесены в чистые функции, чтобы не плодить одинаковые regex/условия в
// нескольких местах server.js (и чтобы pages/register и
// pages/reset-password на фронтенде могли показывать тот же чеклист
// требований, см. shared/ui/PasswordRequirements).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICKNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isValidEmail(email) {
    return EMAIL_RE.test(email);
}

// Минимум 8 символов, хотя бы одна буква и одна цифра — чуть строже
// прежнего "просто 8 символов", чтобы чеклист требований на фронтенде
// (PasswordRequirements) имел смысл показывать несколько пунктов, а не
// один. Не ломает уже существующие аккаунты: правило применяется только
// при УСТАНОВКЕ нового пароля (регистрация, сброс), не при входе — вход
// сравнивает хеш, а не перепроверяет сложность задним числом.
function isValidPassword(password) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 200) return false;
    return /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

function isValidName(name) {
    return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 100;
}

function isValidNickname(nickname) {
    return typeof nickname === 'string' && NICKNAME_RE.test(nickname);
}

function isValidSubject(subject) {
    return typeof subject === 'string' && subject.trim().length >= 1 && subject.trim().length <= 200;
}

function isValidMessage(message) {
    return typeof message === 'string' && message.trim().length >= 1 && message.trim().length <= 5000;
}

// Категории заявок в поддержку — тот же список, что на фронтенде
// (pages/support), значения — ключи, а не отображаемые надписи, чтобы
// можно было поменять текст без миграции данных.
const SUPPORT_CATEGORIES = ['account', 'bug', 'billing', 'other'];

function isValidCategory(category) {
    return typeof category === 'string' && SUPPORT_CATEGORIES.includes(category);
}

module.exports = {
    normalizeEmail,
    isValidEmail,
    isValidPassword,
    isValidName,
    isValidNickname,
    isValidSubject,
    isValidMessage,
    SUPPORT_CATEGORIES,
    isValidCategory,
};
