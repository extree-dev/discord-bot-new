const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { getEnvTrustedIds, isTrusted, load, save, storeName } = require('../security/config');
const { withStoreBackup } = require('./helpers/withBackup');
const { closePool } = require('../utils/db');

// node --test запускает каждый файл в отдельном процессе, но пул
// соединений pg держит event loop живым — без явного закрытия процесс
// будет висеть после того, как все тесты этого файла отработают.
after(() => closePool());

function makeGuild({ ownerId, clientUserId, memberRoles }) {
    const cache = new Map();
    if (memberRoles) {
        cache.set(memberRoles.userId, { roles: { cache: new Set(memberRoles.roleIds) } });
    }
    return {
        ownerId,
        client: { user: { id: clientUserId } },
        members: {
            cache,
            fetch: async () => null,
        },
    };
}

test('getEnvTrustedIds парсит TRUSTED_IDS: обрезает пробелы и убирает пустые значения', () => {
    const original = process.env.TRUSTED_IDS;
    try {
        process.env.TRUSTED_IDS = ' 111, 222,, 333 ';
        assert.deepEqual(getEnvTrustedIds(), ['111', '222', '333']);

        delete process.env.TRUSTED_IDS;
        assert.deepEqual(getEnvTrustedIds(), []);
    } finally {
        if (original === undefined) delete process.env.TRUSTED_IDS;
        else process.env.TRUSTED_IDS = original;
    }
});

test('isTrusted: владелец сервера и сам бот доверены сразу, без остальных проверок', async () => {
    const guild = makeGuild({ ownerId: 'owner-1', clientUserId: 'bot-1' });
    assert.equal(await isTrusted(guild, 'owner-1'), true);
    assert.equal(await isTrusted(guild, 'bot-1'), true);
});

test('isTrusted: посторонний пользователь без доверенных ролей/списков не доверен', async () => {
    // Тут isTrusted дойдёт до load(), поэтому оборачиваем в withStoreBackup —
    // иначе тест молча тронет строку security-config в общей таблице bot_stores.
    await withStoreBackup(storeName, async () => {
        const guild = makeGuild({ ownerId: 'owner-1', clientUserId: 'bot-1' });
        assert.equal(await isTrusted(guild, 'random-user'), false);
    });
});

test('isTrusted: учитывает trustedIds из security-config', async () => {
    await withStoreBackup(storeName, async () => {
        const config = await load();
        config.trustedIds = ['trusted-user-1'];
        await save(config);

        const guild = makeGuild({ ownerId: 'owner-2', clientUserId: 'bot-2' });
        assert.equal(await isTrusted(guild, 'trusted-user-1'), true);
        assert.equal(await isTrusted(guild, 'someone-else'), false);
    });
});

test('isTrusted: учитывает TRUSTED_IDS из переменной окружения', async () => {
    await withStoreBackup(storeName, async () => {
        const original = process.env.TRUSTED_IDS;
        process.env.TRUSTED_IDS = 'env-trusted-1';
        try {
            const guild = makeGuild({ ownerId: 'owner-3', clientUserId: 'bot-3' });
            assert.equal(await isTrusted(guild, 'env-trusted-1'), true);
        } finally {
            if (original === undefined) delete process.env.TRUSTED_IDS;
            else process.env.TRUSTED_IDS = original;
        }
    });
});

test('isTrusted: учитывает роль доверенных (trustedRoleId)', async () => {
    await withStoreBackup(storeName, async () => {
        const config = await load();
        config.trustedRoleId = 'role-trusted';
        await save(config);

        const guild = makeGuild({
            ownerId: 'owner-4',
            clientUserId: 'bot-4',
            memberRoles: { userId: 'role-holder', roleIds: ['role-trusted'] },
        });
        assert.equal(await isTrusted(guild, 'role-holder'), true);
        assert.equal(await isTrusted(guild, 'no-role-user'), false);
    });
});

test('load() подставляет значения по умолчанию для отсутствующих вложенных полей', async () => {
    await withStoreBackup(storeName, async () => {
        await save({ trustedIds: ['x'] });
        const config = await load();
        assert.deepEqual(config.trustedIds, ['x']);
        assert.equal(config.antiNuke.enabled, true);
        assert.equal(config.antiNuke.maxActions, 3);
        assert.equal(config.raidShield.joinThreshold, 8);
        assert.equal(config.verification.enabled, false);
    });
});
