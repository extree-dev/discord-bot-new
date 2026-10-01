const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');
const { applyWarningEscalation, TIMEOUT_THRESHOLD, BAN_THRESHOLD } = require('../security/escalation');
const securityConfig = require('../security/config');
const { withStoreBackup } = require('./helpers/withBackup');
const { closePool } = require('../utils/db');

after(() => closePool());

// Фейковый guild достаточен для log()/notifyPunishment() (оба обёрнуты в
// try/catch внутри своих модулей — не падают, если чего-то не хватает),
// но настоящий лог-канал подкладываем явно, чтобы assert.ok(sent.length)
// проверял реальную отправку, а не тихий catch.
function makeGuild(logChannelId) {
    const sent = [];
    const channel = { send: async embed => sent.push(embed) };
    return {
        id: 'g1',
        channels: {
            cache: { get: id => (id === logChannelId ? channel : undefined) },
            fetch: async () => null,
        },
        _sent: sent,
    };
}

function makeMember({ bannable = true, moderatable = true } = {}) {
    const calls = { ban: [], timeout: [] };
    return {
        id: 'u1',
        user: { tag: 'User#0001' },
        bannable,
        moderatable,
        ban: async opts => {
            calls.ban.push(opts);
        },
        timeout: async (ms, reason) => {
            calls.timeout.push({ ms, reason });
        },
        _calls: calls,
    };
}

test('applyWarningEscalation: ниже порога тайм-аута — ничего не делает', async () => {
    await withStoreBackup(securityConfig.storeName, async () => {
        await securityConfig.update(cfg => {
            cfg.logChannelId = 'log1';
        });
        const guild = makeGuild('log1');
        const member = makeMember();
        const result = await applyWarningEscalation(guild, member, TIMEOUT_THRESHOLD - 1, 'Test');
        assert.equal(result, null);
        assert.equal(member._calls.ban.length, 0);
        assert.equal(member._calls.timeout.length, 0);
    });
});

test('applyWarningEscalation: на пороге тайм-аута — мьютит на 10 минут и логирует', async () => {
    await withStoreBackup(securityConfig.storeName, async () => {
        await securityConfig.update(cfg => {
            cfg.logChannelId = 'log1';
        });
        const guild = makeGuild('log1');
        const member = makeMember();
        const result = await applyWarningEscalation(guild, member, TIMEOUT_THRESHOLD, 'Test');
        assert.equal(result.action, 'timeout');
        assert.equal(member._calls.timeout.length, 1);
        assert.equal(member._calls.timeout[0].ms, 10 * 60 * 1000);
        assert.equal(member._calls.ban.length, 0);
        assert.equal(guild._sent.length, 1);
    });
});

test('applyWarningEscalation: на пороге бана — банит, а не мьютит', async () => {
    await withStoreBackup(securityConfig.storeName, async () => {
        await securityConfig.update(cfg => {
            cfg.logChannelId = 'log1';
        });
        const guild = makeGuild('log1');
        const member = makeMember();
        const result = await applyWarningEscalation(guild, member, BAN_THRESHOLD, 'Test');
        assert.equal(result.action, 'ban');
        assert.equal(member._calls.ban.length, 1);
        assert.equal(member._calls.timeout.length, 0);
    });
});

test('applyWarningEscalation: не банит, если участник не bannable (роль бота ниже)', async () => {
    await withStoreBackup(securityConfig.storeName, async () => {
        await securityConfig.update(cfg => {
            cfg.logChannelId = 'log1';
        });
        const guild = makeGuild('log1');
        const member = makeMember({ bannable: false });
        const result = await applyWarningEscalation(guild, member, BAN_THRESHOLD, 'Test');
        // Не bannable — порог бана не проходит, но порог тайм-аута (ниже)
        // всё равно должен сработать, раз moderatable: true.
        assert.equal(result.action, 'timeout');
        assert.equal(member._calls.ban.length, 0);
    });
});

test('applyWarningEscalation: без member — ничего не делает и не падает', async () => {
    const guild = makeGuild('log1');
    const result = await applyWarningEscalation(guild, null, BAN_THRESHOLD, 'Test');
    assert.equal(result, null);
});
