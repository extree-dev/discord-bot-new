const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Collection, ChannelType } = require('discord.js');
const { createBackup, restoreBackup, backupDir } = require('../security/backup');

// Мок гильдии, достаточный для createBackup()/restoreBackup(): реальная
// discord.js Collection вместо самодельного массива с частичными
// методами — filter/map/sort/find/get ведут себя ровно как в проде.
function makeGuild({ roles = [], channels = [] } = {}) {
    const rolesCache = new Collection(roles.map(r => [r.id, r]));
    const channelsCache = new Collection(channels.map(c => [c.id, c]));
    const createdRoles = [];
    const createdChannels = [];
    return {
        id: 'guild-1',
        roles: {
            cache: rolesCache,
            fetch: async () => rolesCache,
            create: async options => {
                const role = { id: `new-role-${createdRoles.length}`, ...options };
                rolesCache.set(role.id, role);
                createdRoles.push(role);
                return role;
            },
        },
        channels: {
            cache: channelsCache,
            fetch: async () => channelsCache,
            create: async options => {
                const channel = {
                    id: `new-channel-${createdChannels.length}`,
                    ...options,
                    parentId: options.parent ?? null,
                };
                channelsCache.set(channel.id, channel);
                createdChannels.push(channel);
                return channel;
            },
        },
        createdRoles,
        createdChannels,
    };
}

function writeSnapshot(snapshot) {
    const filename = `test-backup-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, filename), JSON.stringify(snapshot));
    return filename;
}

function cleanupSnapshot(filename) {
    const filePath = path.join(backupDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

test('restoreBackup: находит роль по ID даже если её переименовали — не создаёт дубликат', async () => {
    // Ровно баг с сервера: роль когда-то называлась "Admin" (так и записана
    // в бэкапе), администратор переименовал её в "Администратор" — id тот
    // же. Раньше restoreBackup искал только по имени "Admin", не находил
    // и создавал дубликат рядом.
    const renamedRole = {
        id: 'role-1',
        name: 'Администратор',
        color: 0xe74c3c,
        hoist: true,
        mentionable: false,
        permissions: { bitfield: 8n },
    };
    const guild = makeGuild({ roles: [renamedRole] });
    const filename = writeSnapshot({
        roles: [
            {
                id: 'role-1',
                name: 'Admin',
                color: 0xe74c3c,
                hoist: true,
                mentionable: false,
                permissions: '8',
            },
        ],
        categories: [],
        channels: [],
    });

    try {
        const result = await restoreBackup(guild, filename);
        assert.deepEqual(result.createdRoles, []);
        assert.equal(guild.roles.cache.size, 1);
        assert.equal(guild.createdRoles.length, 0);
    } finally {
        cleanupSnapshot(filename);
    }
});

test('restoreBackup: бэкап без ID (старый формат) ищет по имени и создаёт при несовпадении', async () => {
    const guild = makeGuild({ roles: [] });
    const filename = writeSnapshot({
        roles: [{ name: 'Admin', color: 0xe74c3c, hoist: true, mentionable: false, permissions: '8' }],
        categories: [],
        channels: [],
    });

    try {
        const result = await restoreBackup(guild, filename);
        assert.deepEqual(result.createdRoles, ['Admin']);
        assert.equal(guild.roles.cache.size, 1);
    } finally {
        cleanupSnapshot(filename);
    }
});

test('restoreBackup: находит категорию/канал по ID даже при переименовании — не создаёт дубликат', async () => {
    const renamedCategory = { id: 'cat-1', name: 'Инфо', type: ChannelType.GuildCategory, parentId: null };
    const renamedChannel = { id: 'chan-1', name: 'правила-сервера', type: ChannelType.GuildText, parentId: 'cat-1' };
    const guild = makeGuild({ channels: [renamedCategory, renamedChannel] });
    const filename = writeSnapshot({
        roles: [],
        categories: [{ id: 'cat-1', name: '📋 Информация', position: 0 }],
        channels: [
            { id: 'chan-1', name: 'правила', type: ChannelType.GuildText, parentName: '📋 Информация', position: 0 },
        ],
    });

    try {
        const result = await restoreBackup(guild, filename);
        assert.deepEqual(result.createdCategories, []);
        assert.deepEqual(result.createdChannels, []);
        assert.equal(guild.createdChannels.length, 0);
    } finally {
        cleanupSnapshot(filename);
    }
});

test('createBackup: сохраняет ID у ролей/категорий/каналов', async () => {
    const role = {
        id: 'role-1',
        name: 'Moderator',
        color: 0x3498db,
        hoist: true,
        mentionable: false,
        permissions: { bitfield: 16n },
        position: 2,
    };
    const category = { id: 'cat-1', name: 'Общее', type: ChannelType.GuildCategory, position: 0, parent: null };
    const channel = {
        id: 'chan-1',
        name: 'чат',
        type: ChannelType.GuildText,
        position: 0,
        parent: { name: 'Общее' },
    };
    const guild = makeGuild({ roles: [role], channels: [category, channel] });

    const filename = await createBackup(guild);
    try {
        const snapshot = JSON.parse(fs.readFileSync(path.join(backupDir, filename), 'utf8'));
        assert.equal(snapshot.roles[0].id, 'role-1');
        assert.equal(snapshot.categories[0].id, 'cat-1');
        assert.equal(snapshot.channels[0].id, 'chan-1');
    } finally {
        cleanupSnapshot(filename);
    }
});
