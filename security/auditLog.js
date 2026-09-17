const { AuditLogEvent } = require('discord.js');
const { load } = require('./config');
const { log } = require('./logger');
const { COLORS, baseEmbed } = require('../utils/embeds');

async function safeLog(guild, embed) {
    const config = await load();
    if (!config.auditLog.enabled) return;
    await log(guild, embed).catch(() => {});
}

async function wasDoneByBot(guild, type, targetId) {
    try {
        const logs = await guild.fetchAuditLogs({ type, limit: 3 });
        const entry = logs.entries.find(e => e.target?.id === targetId && Date.now() - e.createdTimestamp < 8000);
        return entry?.executor?.bot === true;
    } catch {
        return false;
    }
}

function register(client) {
    client.on('messageDelete', msg => {
        if (!msg.guild || msg.author?.bot) return;
        safeLog(
            msg.guild,
            baseEmbed(COLORS.neutral)
                .setTitle('🗑️ Сообщение удалено')
                .addFields(
                    { name: 'Автор', value: msg.author ? `${msg.author.tag}` : 'неизвестно (не в кэше)', inline: true },
                    { name: 'Канал', value: `${msg.channel}`, inline: true },
                    { name: 'Содержимое', value: msg.content?.slice(0, 1000) || '*(нет текста / не в кэше)*' }
                )
        ).catch(err => console.error('auditLog:', err));
    });

    client.on('messageUpdate', (oldMsg, newMsg) => {
        if (!newMsg.guild || newMsg.author?.bot) return;
        if (oldMsg.content === newMsg.content) return;
        safeLog(
            newMsg.guild,
            baseEmbed(COLORS.neutral)
                .setTitle('✏️ Сообщение изменено')
                .addFields(
                    { name: 'Автор', value: `${newMsg.author.tag}`, inline: true },
                    { name: 'Канал', value: `${newMsg.channel}`, inline: true },
                    { name: 'Было', value: (oldMsg.content || '*(пусто / не в кэше)*').slice(0, 500) },
                    { name: 'Стало', value: (newMsg.content || '*(пусто)*').slice(0, 500) }
                )
        ).catch(err => console.error('auditLog:', err));
    });

    client.on('guildBanAdd', ban => {
        safeLog(
            ban.guild,
            baseEmbed(COLORS.danger)
                .setTitle('🔨 Бан')
                .addFields({ name: 'Участник', value: `${ban.user.tag} (${ban.user.id})` })
        ).catch(err => console.error('auditLog:', err));
    });

    client.on('guildBanRemove', ban => {
        safeLog(
            ban.guild,
            baseEmbed(COLORS.success)
                .setTitle('🔓 Разбан')
                .addFields({ name: 'Участник', value: `${ban.user.tag} (${ban.user.id})` })
        ).catch(err => console.error('auditLog:', err));
    });

    client.on('guildMemberRemove', member => {
        safeLog(
            member.guild,
            baseEmbed(COLORS.neutral)
                .setTitle('👋 Участник вышел или был кикнут')
                .addFields({ name: 'Участник', value: `${member.user.tag} (${member.id})` })
        ).catch(err => console.error('auditLog:', err));
    });

    client.on('channelCreate', async ch => {
        if (!ch.guild) return;
        if (await wasDoneByBot(ch.guild, AuditLogEvent.ChannelCreate, ch.id)) return;
        safeLog(
            ch.guild,
            baseEmbed(COLORS.success)
                .setTitle('📁 Канал создан')
                .addFields({ name: 'Канал', value: `${ch.name}` })
        ).catch(err => console.error('auditLog:', err));
    });

    client.on('roleCreate', async role => {
        if (await wasDoneByBot(role.guild, AuditLogEvent.RoleCreate, role.id)) return;
        safeLog(
            role.guild,
            baseEmbed(COLORS.success).setTitle('🏷️ Роль создана').addFields({ name: 'Роль', value: role.name })
        ).catch(err => console.error('auditLog:', err));
    });
}

module.exports = { register };
