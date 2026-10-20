// Общие проверки для /auth/register и /auth/login — вынесены в чистые
// функции, чтобы не плодить одинаковые regex/условия в двух местах
// server.js.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isValidEmail(email) {
    return EMAIL_RE.test(email);
}

function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 8 && password.length <= 200;
}

module.exports = { normalizeEmail, isValidEmail, isValidPassword };
