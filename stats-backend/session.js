// Та же схема, что dashboard/session.js: сессия целиком в одной
// httpOnly-cookie, AES-256-GCM поверх секрета, без отдельного стора.
// Код продублирован, а не переиспользован через require('../dashboard/
// session') — это ровно 40 строк без единой детали, специфичной для
// бота/дашборда, и Extree Stats намеренно независимый продукт (свой
// домен, своя заявка в Riot Developer Portal, см. stats-frontend/):
// завязываться на модуль внутри dashboard/ значило бы по коду связать
// два продукта, которые должны уметь жить и деплоиться отдельно.
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

// Возвращает null на любую проблему (битая/подделанная cookie) —
// вызывающий код трактует null просто как "не залогинен".
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
