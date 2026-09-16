const fs = require('fs');
const path = require('path');
const { ChannelType } = require('discord.js');

const backupDir = path.join(__dirname, '..', 'data', 'backups');

function ensureDir() {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
}

function rotateOldBackups(keep = 10) {
    ensureDir();
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort();
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
            name: r.name,
            color: r.color,
            hoist: r.hoist,
            mentionable: r.mentionable,
            permissions: r.permissions.bitfield.toString(),
            position: r.position,
        }));

    const categories = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .map(c => ({ name: c.name, position: c.position }));

    const channels = guild.channels.cache
        .filter(c => c.type !== ChannelType.GuildCategory)
        .map(c => ({
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
    return fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
}

async function restoreBackup(guild, filename) {
    ensureDir();
    const filePath = path.join(backupDir, filename);
    if (!fs.existsSync(filePath)) throw new Error('Файл бэкапа не найден');
    const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    await guild.roles.fetch();
    await guild.channels.fetch();

    const createdRoles = [];
    for (const r of snapshot.roles) {
        const exists = guild.roles.cache.find(role => role.name === r.name);
        if (exists) continue;
        await guild.roles.create({
            name: r.name,
            color: r.color,
            hoist: r.hoist,
            mentionable: r.mentionable,
            permissions: BigInt(r.permissions),
        });
        createdRoles.push(r.name);
    }

    const createdCategories = [];
    for (const c of snapshot.categories) {
        const exists = guild.channels.cache.find(ch => ch.type === ChannelType.GuildCategory && ch.name === c.name);
        if (exists) continue;
        await guild.channels.create({ name: c.name, type: ChannelType.GuildCategory });
        createdCategories.push(c.name);
    }

    await guild.channels.fetch();
    const createdChannels = [];
    for (const ch of snapshot.channels) {
        const exists = guild.channels.cache.find(c => c.name === ch.name && c.type === ch.type);
        if (exists) continue;
        const parent = ch.parentName
            ? guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === ch.parentName)
            : null;
        await guild.channels.create({ name: ch.name, type: ch.type, parent: parent?.id });
        createdChannels.push(ch.name);
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
