const test = require('node:test');
const assert = require('node:assert/strict');
const { isBootstrap, ensureChannel, ensureRole, refreshPanel } = require('../utils/setupMode');

function makeGuild({ channels = [], roles = [] } = {}) {
    const created = [];
    const collection = items => ({
        get: id => items.find(i => i.id === id) ?? null,
        filter: predicate => items.filter(predicate),
    });
    return {
        channels: {
            cache: collection(channels),
            create: async options => created.push(options),
        },
        roles: {
            cache: collection(roles),
            create: async options => created.push(options),
        },
        created,
    };
}

function silenced(fn) {
    return async () => {
        const warn = console.warn;
        const log = console.log;
        console.warn = () => {};
        console.log = () => {};
        try {
            await fn();
        } finally {
            console.warn = warn;
            console.log = log;
        }
    };
}

test('setupMode: без --bootstrap скрипт работает в режиме синхронизации', () => {
    assert.equal(isBootstrap(), false);
});

test(
    'ensureChannel: в режиме синхронизации отсутствующий канал не создаётся',
    silenced(async () => {
        const guild = makeGuild();
        const { channel, created } = await ensureChannel({ guild, name: 'правила', type: 0 });
        assert.equal(channel, null);
        assert.equal(created, false);
        assert.equal(guild.created.length, 0);
    })
);

test(
    'ensureChannel: существующий канал находится по сохранённому ID',
    silenced(async () => {
        const existing = { id: 'c1', name: 'переименован-вручную', type: 0 };
        const guild = makeGuild({ channels: [existing] });
        const { channel } = await ensureChannel({ guild, existingId: 'c1', name: 'правила', type: 0 });
        assert.equal(channel, existing);
    })
);

test(
    'ensureRole: в режиме синхронизации отсутствующая роль не создаётся',
    silenced(async () => {
        const guild = makeGuild();
        const { role, created } = await ensureRole({ guild, name: 'Support', color: 1 });
        assert.equal(role, null);
        assert.equal(created, false);
        assert.equal(guild.created.length, 0);
    })
);

function makeChannel(messages) {
    const sent = [];
    return {
        name: 'панель',
        messages: { fetch: async () => messages },
        send: async payload => sent.push(payload),
        sent,
    };
}

test(
    'refreshPanel: существующая панель бота обновляется',
    silenced(async () => {
        const edits = [];
        const panel = { author: { id: 'bot' }, components: [1], edit: async p => edits.push(p) };
        const channel = makeChannel([panel]);
        const result = await refreshPanel({ channel, botId: 'bot', payload: { x: 1 }, label: 'Тест' });
        assert.equal(result, panel);
        assert.deepEqual(edits, [{ x: 1 }]);
        assert.equal(channel.sent.length, 0);
    })
);

test(
    'refreshPanel: без панели в режиме синхронизации новое сообщение не отправляется',
    silenced(async () => {
        const channel = makeChannel([{ author: { id: 'someone' }, components: [1] }]);
        const result = await refreshPanel({ channel, botId: 'bot', payload: { x: 1 }, label: 'Тест' });
        assert.equal(result, null);
        assert.equal(channel.sent.length, 0);
    })
);
