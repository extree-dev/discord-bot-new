const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const model = require('../voice/model');

test('ROOM_EVERYONE_DENY: запрещает инвайт, активность, саундборд и статус канала — имена флагов существуют в discord.js', () => {
    for (const [flag, value] of Object.entries(model.ROOM_EVERYONE_DENY)) {
        assert.equal(value, false, `${flag} должен быть false (запрет), а не null/true`);
        assert.equal(typeof PermissionFlagsBits[flag], 'bigint', `${flag} — не существующий флаг PermissionFlagsBits`);
    }
    for (const flag of ['CreateInstantInvite', 'UseEmbeddedActivities', 'UseSoundboard', 'SetVoiceChannelStatus']) {
        assert.ok(flag in model.ROOM_EVERYONE_DENY, `${flag} должен быть в ROOM_EVERYONE_DENY`);
    }
});

test('ownerPermissions: у владельца нет серверного мута и глушения', () => {
    const perms = model.ownerPermissions();
    assert.equal(perms.MuteMembers, undefined);
    assert.equal(perms.DeafenMembers, undefined);
    assert.equal(model.OWNER_PERMISSION_FLAGS.includes(PermissionFlagsBits.MuteMembers), false);
    assert.equal(model.OWNER_PERMISSION_FLAGS.includes(PermissionFlagsBits.DeafenMembers), false);
});

test('validateRoomName: пропускает обычное название', () => {
    assert.equal(model.validateRoomName('Катка вечером'), null);
});

test('validateRoomName: отклоняет ссылки, инвайты и массовые упоминания', () => {
    assert.ok(model.validateRoomName('заходи discord.gg/abc123'));
    assert.ok(model.validateRoomName('https://example.com'));
    assert.ok(model.validateRoomName('www.example.com'));
    assert.ok(model.validateRoomName('@everyone сюда'));
    assert.ok(model.validateRoomName('всем @here'));
    assert.ok(model.validateRoomName(''));
});

test('validateRoomName: отклоняет запрещённые слова из конфига без учёта регистра', () => {
    assert.ok(model.validateRoomName('Комната ПлОхОеСлОвО', ['плохоеслово']));
    assert.equal(model.validateRoomName('Комната', ['плохоеслово', '']), null);
});

test('renameRoom: после двух переименований за 10 минут третье придётся ждать', async () => {
    const channel = { id: 'rename-limit', setName: async () => {} };
    assert.equal(model.renameWaitMs(channel.id), 0);
    await model.renameRoom(channel, 'a');
    assert.equal(model.renameWaitMs(channel.id), 0);
    await model.renameRoom(channel, 'b');
    const wait = model.renameWaitMs(channel.id);
    assert.ok(wait > 0 && wait <= 10 * 60 * 1000);
    assert.equal(model.renameWaitMs(channel.id, Date.now() + 10 * 60 * 1000 + 1), 0);
});

test('renameRoom и setRoomLimit не глотают ошибки Discord', async () => {
    const channel = {
        id: 'rename-error',
        setName: async () => {
            throw new Error('Missing Permissions');
        },
        setUserLimit: async () => {
            throw new Error('Missing Permissions');
        },
    };
    await assert.rejects(model.renameRoom(channel, 'x'));
    await assert.rejects(model.setRoomLimit(channel, 3));
    // Неудачная попытка не расходует лимит переименований.
    assert.equal(model.renameWaitMs(channel.id), 0);
});

test('createCooldownMs: без недавнего создания комнаты ждать не нужно', () => {
    assert.equal(model.createCooldownMs('never-created'), 0);
});

test('getRoomMembers: только участники комнаты, без владельца и ботов', () => {
    const member = (id, bot = false) => [id, { id, user: { bot } }];
    const channel = { members: new Map([member('owner'), member('guest'), member('bot', true)]) };
    const ids = model.getRoomMembers(channel, { ownerId: 'owner' }).map(m => m.id);
    assert.deepEqual(ids, ['guest']);
});

test('handleVoiceStateUpdate: без смены канала (мут, стрим) в базу не ходит', async () => {
    const state = { channelId: 'room', member: { user: { bot: false } } };
    // Если бы функция пошла в load(), без базы тест упал бы с ошибкой
    // подключения — ранний выход должен сработать раньше.
    await model.handleVoiceStateUpdate(state, state);
});

test('sweepRooms: убирает брошенные пустые комнаты и записи об удалённых каналах', async () => {
    const { load, update } = require('../voice/config');
    const now = Date.now();
    const deleted = [];
    const edits = [];
    const guild = { roles: { everyone: { id: 'everyone' } } };
    // allowMute — старая комната с не снятым MuteMembers у владельца;
    // denyEveryone — уже настроенный запрет инвайта/активности/саундборда
    // у @everyone (deny.has всегда true), чтобы sweepRooms не редактировал
    // то, что уже верно.
    const overwrites = ({ owner, allowMute, denyEveryone }) => ({
        cache: new Map([
            [owner, { allow: { has: bit => allowMute && bit === PermissionFlagsBits.MuteMembers } }],
            ['everyone', { deny: { has: () => denyEveryone } }],
        ]),
        edit: async (id, perms) => edits.push({ id, perms }),
    });
    const room = (id, members, opts) => ({
        id,
        guild,
        members: { size: members },
        permissionOverwrites: overwrites(opts),
        delete: async () => deleted.push(id),
    });
    const channels = {
        'sweep-empty': room('sweep-empty', 0, { owner: 'a' }),
        'sweep-fresh': room('sweep-fresh', 0, { owner: 'b' }),
        'sweep-busy': room('sweep-busy', 2, { owner: 'owner-busy', allowMute: true, denyEveryone: false }),
        'sweep-configured': room('sweep-configured', 2, { owner: 'owner-configured', denyEveryone: true }),
    };
    const client = {
        channels: {
            cache: new Map(Object.entries(channels)),
            fetch: async id => {
                const err = new Error('fetch failed');
                if (id === 'sweep-gone') err.code = 10003;
                throw err;
            },
        },
    };

    const before = await load();
    await update(cfg => {
        cfg.channels = {
            'sweep-empty': { ownerId: 'a', createdAt: now - 10 * 60 * 1000 },
            'sweep-fresh': { ownerId: 'b', createdAt: now },
            'sweep-busy': { ownerId: 'owner-busy', createdAt: now - 10 * 60 * 1000 },
            'sweep-configured': { ownerId: 'owner-configured', createdAt: now - 10 * 60 * 1000 },
            'sweep-gone': { ownerId: 'c', createdAt: now - 10 * 60 * 1000 },
            'sweep-network': { ownerId: 'd', createdAt: now - 10 * 60 * 1000 },
        };
    });
    try {
        await model.sweepRooms(client, now);
        const after = await load();
        assert.deepEqual(Object.keys(after.channels).sort(), [
            'sweep-busy',
            'sweep-configured',
            'sweep-fresh',
            'sweep-network',
        ]);
        assert.deepEqual(deleted, ['sweep-empty']);
        assert.deepEqual(edits, [
            { id: 'owner-busy', perms: { MuteMembers: null, DeafenMembers: null } },
            { id: 'everyone', perms: model.ROOM_EVERYONE_DENY },
        ]);
    } finally {
        await update(cfg => {
            cfg.channels = before.channels;
        });
    }
});
