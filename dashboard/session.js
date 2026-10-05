// Сессия дашборда целиком живёт в одной httpOnly-cookie — AES-256-GCM
// поверх SESSION_SECRET, без отдельной таблицы/стора в Postgres:
// дашборд версии 1 только показывает список серверов, ничего не пишет,
// так что серверных данных про пользователя нет вообще, кроме самого
// Discord access_token, которым эти данные каждый раз заново
// запрашиваются у Discord при заходе на /dashboard.
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(secret) {
    return crypto.createHash('sha256').update(secret).digest();
}

function encryptSession(payload, secret) {
    const key = deriveKey(secret);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const json = Buffer.from(JSON.stringify(payload), 'utf8');
    const encrypted = Buffer.concat([cipher.update(json), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

// Возвращает null на любую проблему (битая/подделанная/просроченного
// формата cookie) — вызывающий код (dashboard/server.js) трактует null
// просто как "не залогинен", без отдельной обработки ошибок формата.
function decryptSession(token, secret) {
    try {
        const raw = Buffer.from(token, 'base64url');
        const iv = raw.subarray(0, IV_LENGTH);
        const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
        const key = deriveKey(secret);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return JSON.parse(decrypted.toString('utf8'));
    } catch {
        return null;
    }
}

module.exports = { encryptSession, decryptSession };
