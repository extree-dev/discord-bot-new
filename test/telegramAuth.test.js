const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { verifyTelegramAuth } = require('../dashboard/telegramAuth');

const BOT_TOKEN = 'test-bot-token';

function sign(fields, botToken = BOT_TOKEN) {
    const dataCheckString = Object.keys(fields)
        .sort()
        .map(key => `${key}=${fields[key]}`)
        .join('\n');
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return { ...fields, hash };
}

test('verifyTelegramAuth: корректная подпись с текущим auth_date — true', () => {
    const data = sign({
        id: '123',
        first_name: 'A',
        username: 'auser',
        auth_date: String(Math.floor(Date.now() / 1000)),
    });
    assert.equal(verifyTelegramAuth(data, BOT_TOKEN), true);
});

test('verifyTelegramAuth: неверный секрет (другой токен бота) — false', () => {
    const data = sign({ id: '123', auth_date: String(Math.floor(Date.now() / 1000)) });
    assert.equal(verifyTelegramAuth(data, 'wrong-token'), false);
});

test('verifyTelegramAuth: подделанное поле ломает подпись — false', () => {
    const data = sign({ id: '123', auth_date: String(Math.floor(Date.now() / 1000)) });
    assert.equal(verifyTelegramAuth({ ...data, id: '999' }, BOT_TOKEN), false);
});

test('verifyTelegramAuth: протухший auth_date (больше суток назад) — false', () => {
    const staleDate = String(Math.floor(Date.now() / 1000) - 25 * 60 * 60);
    const data = sign({ id: '123', auth_date: staleDate });
    assert.equal(verifyTelegramAuth(data, BOT_TOKEN), false);
});

test('verifyTelegramAuth: отсутствуют обязательные поля — false, не исключение', () => {
    assert.equal(verifyTelegramAuth(null, BOT_TOKEN), false);
    assert.equal(verifyTelegramAuth({}, BOT_TOKEN), false);
    assert.equal(verifyTelegramAuth({ id: '1', auth_date: '1' }, BOT_TOKEN), false);
});
