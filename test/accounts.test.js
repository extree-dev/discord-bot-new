const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const accounts = require('../dashboard/accounts');
const { withStoreBackup } = require('./helpers/withBackup');
const { closePool } = require('../utils/db');

after(() => closePool());

test('hashPassword/verifyPasswordHash: круглый путь, разные пароли не совпадают', () => {
    const hash = accounts.hashPassword('correct horse battery staple');
    assert.equal(accounts.verifyPasswordHash('correct horse battery staple', hash), true);
    assert.equal(accounts.verifyPasswordHash('wrong password', hash), false);
});

test('verifyPasswordHash: пустой/битый хэш — false, а не исключение', () => {
    assert.equal(accounts.verifyPasswordHash('x', null), false);
    assert.equal(accounts.verifyPasswordHash('x', ''), false);
    assert.equal(accounts.verifyPasswordHash('x', 'no-colon-here'), false);
});

test('findOrCreateByDiscordId: первый вызов создаёт аккаунт, повторный находит тот же', async () => {
    await withStoreBackup(accounts.storeName, async () => {
        const first = await accounts.findOrCreateByDiscordId('111', { username: 'A', avatar: 'a1' });
        const second = await accounts.findOrCreateByDiscordId('111', { username: 'A-renamed' });
        assert.equal(first.id, second.id);
        assert.equal(second.discordUsername, 'A-renamed');
        assert.equal(second.discordAvatar, 'a1');
    });
});

test('linkTelegram: привязывает telegramId к аккаунту, конфликт с другим аккаунтом бросает ошибку', async () => {
    await withStoreBackup(accounts.storeName, async () => {
        const accA = await accounts.findOrCreateByDiscordId('aaa');
        const accB = await accounts.findOrCreateByDiscordId('bbb');
        const linked = await accounts.linkTelegram(accA.id, 'tg-1', 'tguser');
        assert.equal(linked.telegramId, 'tg-1');

        await assert.rejects(() => accounts.linkTelegram(accB.id, 'tg-1', 'other'), /telegram_already_linked/);
    });
});

test('findByTelegramId: находит привязанный аккаунт', async () => {
    await withStoreBackup(accounts.storeName, async () => {
        const acc = await accounts.findOrCreateByDiscordId('ccc');
        await accounts.linkTelegram(acc.id, 'tg-2', 'u');
        const found = await accounts.findByTelegramId('tg-2');
        assert.equal(found.id, acc.id);
        assert.equal(await accounts.findByTelegramId('does-not-exist'), null);
    });
});

test('setPassword + verifyEmailLogin: круглый путь, конфликт email между аккаунтами бросает ошибку', async () => {
    await withStoreBackup(accounts.storeName, async () => {
        const accA = await accounts.findOrCreateByDiscordId('ddd');
        const accB = await accounts.findOrCreateByDiscordId('eee');
        await accounts.setPassword(accA.id, 'a@example.com', 'super-secret-1');

        const ok = await accounts.verifyEmailLogin('a@example.com', 'super-secret-1');
        assert.equal(ok.id, accA.id);
        assert.equal(await accounts.verifyEmailLogin('a@example.com', 'wrong'), null);
        assert.equal(await accounts.verifyEmailLogin('nobody@example.com', 'x'), null);

        await assert.rejects(() => accounts.setPassword(accB.id, 'a@example.com', 'whatever1'), /email_already_used/);
    });
});
