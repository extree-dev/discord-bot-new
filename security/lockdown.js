// Ручной "рубильник" полной блокировки сервера (в дополнение к
// автоматическому raid shield): запрещает @everyone писать в текстовых
// каналах и заходить в голосовые. Запоминает, какие каналы закрыл
// именно lockdown, чтобы при снятии открыть обратно только их — а не
// каналы, которые были закрыты и без lockdown по другой причине.
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, update } = require('./config');
const { log } = require('./logger');
const { COLORS, baseEmbed, formatBody } = require('../utils/embeds');

const LOCKABLE_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement]);

function isAlreadyDenied(channel, everyoneId) {
    const overwrite = channel.permissionOverwrites.cache.get(everyoneId);
    if (!overwrite) return false;
    return channel.type === ChannelType.GuildVoice
        ? overwrite.deny.has(PermissionFlagsBits.Connect)
        : overwrite.deny.has(PermissionFlagsBits.SendMessages);
}

async function activate(guild, moderator) {
    const config = await load();
    if (config.manualLockdown.active) {
        return { alreadyActive: true };
    }

    const everyone = guild.roles.everyone;
    const channels = guild.channels.cache.filter(ch => LOCKABLE_TYPES.has(ch.type));

    const lockedChannelIds = [];
    for (const channel of channels.values()) {
        if (isAlreadyDenied(channel, everyone.id)) continue;

        const deny = channel.type === ChannelType.GuildVoice ? { Connect: false } : { SendMessages: false };
        const applied = await channel.permissionOverwrites
            .edit(everyone, deny, { reason: `Lockdown включён: ${moderator.tag}` })
            .then(() => true)
            .catch(() => false);
        if (applied) lockedChannelIds.push(channel.id);
    }

    await update(cfg => {
        cfg.manualLockdown = { active: true, channelIds: lockedChannelIds };
    });

    await log(
        guild,
        baseEmbed(COLORS.critical)
            .setDescription(
                formatBody(
                    'Lockdown включён',
                    'Всем участникам запрещено писать в текстовых каналах и заходить в голосовые.'
                )
            )
            .addFields(
                { name: 'Каналов закрыто', value: `${lockedChannelIds.length}`, inline: true },
                { name: 'Включил', value: `${moderator}`, inline: true }
            )
    );

    return { alreadyActive: false, count: lockedChannelIds.length };
}

async function deactivate(guild, moderator) {
    const config = await load();
    if (!config.manualLockdown.active) {
        return { wasActive: false };
    }

    const everyone = guild.roles.everyone;
    for (const channelId of config.manualLockdown.channelIds) {
        const channel = guild.channels.cache.get(channelId);
        if (!channel) continue;
        await channel.permissionOverwrites.delete(everyone, `Lockdown снят: ${moderator.tag}`).catch(() => {});
    }

    const count = config.manualLockdown.channelIds.length;
    await update(cfg => {
        cfg.manualLockdown = { active: false, channelIds: [] };
    });

    await log(
        guild,
        baseEmbed(COLORS.success)
            .setDescription(formatBody('Lockdown снят'))
            .addFields(
                { name: 'Каналов открыто заново', value: `${count}`, inline: true },
                { name: 'Снял', value: `${moderator}`, inline: true }
            )
    );

    return { wasActive: true, count };
}

module.exports = { activate, deactivate };
