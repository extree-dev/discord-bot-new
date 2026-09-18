const test = require('node:test');
const assert = require('node:assert/strict');
const { findOrCreateChannel, findOrCreateRole } = require('../scripts/lib/idempotent');

function makeGuild({ channels = [], roles = [] } = {}) {
    const createdChannels = [];
    const createdRoles = [];
    return {
        channels: {
            cache: {
                get: id => channels.find(c => c.id === id) ?? null,
                find: predicate => channels.find(predicate) ?? null,
            },
            create: async options => {
                const channel = { id: `new-channel-${createdChannels.length}`, ...options };
                createdChannels.push(channel);
                return channel;
            },
        },
        roles: {
            cache: {
                get: id => roles.find(r => r.id === id) ?? null,
                find: predicate => roles.find(predicate) ?? null,
            },
            create: async options => {
                const role = { id: `new-role-${createdRoles.length}`, ...options };
                createdRoles.push(role);
                return role;
            },
        },
        createdChannels,
        createdRoles,
    };
}

test('findOrCreateChannel: канал уже настроен по ID — используется как есть, даже если имя не совпадает', async () => {
    const renamedChannel = { id: 'chan-1', type: 'text', name: 'моё-имя', parentId: 'cat-1' };
    const guild = makeGuild({ channels: [renamedChannel] });

    const { channel, created } = await findOrCreateChannel({
        guild,
        existingId: 'chan-1',
        name: 'дефолтное-имя',
        type: 'text',
        parentId: 'cat-1',
    });

    assert.equal(channel, renamedChannel);
    assert.equal(created, false);
    assert.equal(guild.createdChannels.length, 0);
});

test('findOrCreateChannel: ID не настроен — ищет по имени, не создаёт дубликат', async () => {
    const existing = { id: 'chan-2', type: 'text', name: 'канал', parentId: 'cat-1' };
    const guild = makeGuild({ channels: [existing] });

    const { channel, created } = await findOrCreateChannel({
        guild,
        existingId: null,
        name: 'канал',
        type: 'text',
        parentId: 'cat-1',
    });

    assert.equal(channel, existing);
    assert.equal(created, false);
    assert.equal(guild.createdChannels.length, 0);
});

test('findOrCreateChannel: ничего не найдено — создаёт новый канал', async () => {
    const guild = makeGuild();

    const { channel, created } = await findOrCreateChannel({
        guild,
        existingId: null,
        name: 'новый-канал',
        type: 'text',
        parentId: null,
    });

    assert.equal(created, true);
    assert.equal(channel.name, 'новый-канал');
    assert.equal(guild.createdChannels.length, 1);
});

test('findOrCreateRole: роль уже настроена по ID — используется как есть, даже если имя не совпадает', async () => {
    const renamedRole = { id: 'role-1', name: 'Кастомное имя' };
    const guild = makeGuild({ roles: [renamedRole] });

    const { role, created } = await findOrCreateRole({
        guild,
        existingId: 'role-1',
        name: 'Дефолтное имя',
        color: 0x000000,
    });

    assert.equal(role, renamedRole);
    assert.equal(created, false);
    assert.equal(guild.createdRoles.length, 0);
});

test('findOrCreateRole: ничего не найдено — создаёт новую роль', async () => {
    const guild = makeGuild();

    const { role, created } = await findOrCreateRole({
        guild,
        existingId: null,
        name: 'Новая роль',
        color: 0x123456,
    });

    assert.equal(created, true);
    assert.equal(role.name, 'Новая роль');
    assert.equal(guild.createdRoles.length, 1);
});
