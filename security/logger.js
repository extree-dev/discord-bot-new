const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { load, update } = require('./config');

const pendingCreation = new Map();

async function createLogChannel(guild) {
    let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === '🔐 Модерация'
    );
    if (!category) {
        category = await guild.channels.create({
            name: '🔐 Модерация',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            ],
        });
    }

    let channel = guild.channels.cache.find(c => c.parentId === category.id && c.name === 'security-log');
    if (!channel) {
        channel = await guild.channels.create({
            name: 'security-log',
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            ],
        });
    }

    await update(config => {
        config.logChannelId = channel.id;
    });

    return channel;
}

async function getLogChannel(guild) {
    const config = load();
    if (config.logChannelId) {
        const cached = guild.channels.cache.get(config.logChannelId);
        if (cached) return cached;
    }

    // Несколько событий могут одновременно захотеть создать лог-канал —
    // без этой блокировки это приводило к дублированию категории/канала.
    if (pendingCreation.has(guild.id)) {
        return pendingCreation.get(guild.id);
    }

    const creation = createLogChannel(guild).finally(() => pendingCreation.delete(guild.id));
    pendingCreation.set(guild.id, creation);
    return creation;
}

async function log(guild, embed) {
    try {
        const channel = await getLogChannel(guild);
        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error('Не удалось отправить лог безопасности:', err);
    }
}

async function alertOwner(guild, title, description) {
    try {
        const owner = await guild.fetchOwner();
        const embed = new EmbedBuilder().setColor(0xed4245).setTitle(title).setDescription(description).setTimestamp();
        await owner.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
        console.error('Не удалось отправить DM владельцу:', err);
    }
}

module.exports = { getLogChannel, log, alertOwner };
