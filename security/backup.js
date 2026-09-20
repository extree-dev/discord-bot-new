const fs = require('fs');
const path = require('path');
const { ChannelType } = require('discord.js');
const { findOrCreateChannel, findOrCreateRole } = require('../utils/idempotent');

const backupDir = path.join(__dirname, '..', 'data', 'backups');

function ensureDir() {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
}

function rotateOldBackups(keep = 10) {
    ensureDir();
    const files = fs
        .readdirSync(backupDir)
        .filter(f => f.endsWith('.json'))
        .sort();
    while (files.length > keep) {
        fs.unlinkSync(path.join(backupDir, files.shift()));
    }
}

async function createBackup(guild) {
    ensureDir();
    await guild.channels.fetch();
    await guild.roles.fetch();

    const roles = guild.roles.cache
        .filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => ({
            id: r.id,
            name: r.name,
            color: r.color,
            hoist: r.hoist,
            mentionable: r.mentionable,
            permissions: r.permissions.bitfield.toString(),
            position: r.position,
        }));

    const categories = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .map(c => ({ id: c.id, name: c.name, position: c.position }));

    const channels = guild.channels.cache
        .filter(c => c.type !== ChannelType.GuildCategory)
        .map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            parentName: c.parent?.name ?? null,
            position: c.position,
        }));

    const snapshot = {
        createdAt: new Date().toISOString(),
        guildId: guild.id,
        guildName: guild.name,
        roles,
        categories,
        channels: Array.from(channels.values()),
    };

    const filename = `backup-${Date.now()}.json`;
    fs.writeFileSync(path.join(backupDir, filename), JSON.stringify(snapshot, null, 2));
    rotateOldBackups();
    return filename;
}

function listBackups() {
    ensureDir();
    return fs
        .readdirSync(backupDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();
}

// existingId: r.id/c.id/ch.id — из бэкапов, снятых до этого фикса, у
// записей ID нет (поле undefined), тогда findOrCreateRole/findOrCreateChannel
// сами откатываются на поиск по имени, как и раньше. Для новых бэкапов
// это и есть главное исправление: раньше восстановление искало роль/канал
// только по имени — если админ переименовал что-то после снятия бэкапа,
// поиск не находил его и создавал рядом дубликат со старым именем (так
// на сервере задвоилась роль Admin). Теперь ID в приоритете — переименование
// не мешает найти тот же объект, а не тот, что уже реально удалён.
async function restoreBackup(guild, filename) {
    ensureDir();
    const filePath = path.join(backupDir, filename);
    if (!fs.existsSync(filePath)) throw new Error('Файл бэкапа не найден');
    const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    await guild.roles.fetch();
    await guild.channels.fetch();

    const createdRoles = [];
    for (const r of snapshot.roles) {
        const { role, created } = await findOrCreateRole({
            guild,
            existingId: r.id,
            name: r.name,
            color: r.color,
            hoist: r.hoist,
            mentionable: r.mentionable,
            permissions: BigInt(r.permissions),
        });
        if (created) createdRoles.push(role.name);
    }

    const createdCategories = [];
    const categoryByName = new Map();
    for (const c of snapshot.categories) {
        const { channel: category, created } = await findOrCreateChannel({
            guild,
            existingId: c.id,
            name: c.name,
            type: ChannelType.GuildCategory,
        });
        categoryByName.set(c.name, category);
        if (created) createdCategories.push(category.name);
    }

    await guild.channels.fetch();
    const createdChannels = [];
    for (const ch of snapshot.channels) {
        const parent = ch.parentName ? categoryByName.get(ch.parentName) : null;
        const { channel, created } = await findOrCreateChannel({
            guild,
            existingId: ch.id,
            name: ch.name,
            type: ch.type,
            parentId: parent?.id,
        });
        if (created) createdChannels.push(channel.name);
    }

    return { createdRoles, createdCategories, createdChannels };
}

function scheduleAutoBackup(client, intervalMs = 6 * 60 * 60 * 1000) {
    setInterval(async () => {
        for (const guild of client.guilds.cache.values()) {
            try {
                await createBackup(guild);
            } catch (err) {
                console.error('Автобэкап не удался для', guild.id, err.message);
            }
        }
    }, intervalMs);
}

module.exports = { createBackup, listBackups, restoreBackup, scheduleAutoBackup, backupDir };
