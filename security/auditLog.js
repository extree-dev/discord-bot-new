const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { load } = require('./config');
const { log } = require('./logger');

function safeLog(guild, embed) {
    const config = load();
    if (!config.auditLog.enabled) return;
    log(guild, embed).catch(() => {});
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
            new EmbedBuilder()
                .setColor(0x999999)
                .setTitle('🗑️ Сообщение удалено')
                .addFields(
                    { name: 'Автор', value: msg.author ? `${msg.author.tag}` : 'неизвестно (не в кэше)', inline: true },
                    { name: 'Канал', value: `${msg.channel}`, inline: true },
                    { name: 'Содержимое', value: (msg.content?.slice(0, 1000)) || '*(нет текста / не в кэше)*' }
                )
                .setTimestamp()
        );
    });

    client.on('messageUpdate', (oldMsg, newMsg) => {
        if (!newMsg.guild || newMsg.author?.bot) return;
        if (oldMsg.content === newMsg.content) return;
        safeLog(
            newMsg.guild,
            new EmbedBuilder()
                .setColor(0x5599ff)
                .setTitle('✏️ Сообщение изменено')
                .addFields(
                    { name: 'Автор', value: `${newMsg.author.tag}`, inline: true },
                    { name: 'Канал', value: `${newMsg.channel}`, inline: true },
                    { name: 'Было', value: (oldMsg.content || '*(пусто / не в кэше)*').slice(0, 500) },
                    { name: 'Стало', value: (newMsg.content || '*(пусто)*').slice(0, 500) }
                )
                .setTimestamp()
        );
    });

    client.on('guildBanAdd', ban => {
        safeLog(
            ban.guild,
            new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🔨 Бан')
                .addFields({ name: 'Участник', value: `${ban.user.tag} (${ban.user.id})` })
                .setTimestamp()
        );
    });

    client.on('guildBanRemove', ban => {
        safeLog(
            ban.guild,
            new EmbedBuilder()
                .setColor(0x00cc66)
                .setTitle('🔓 Разбан')
                .addFields({ name: 'Участник', value: `${ban.user.tag} (${ban.user.id})` })
                .setTimestamp()
        );
    });

    client.on('guildMemberRemove', member => {
        safeLog(
            member.guild,
            new EmbedBuilder()
                .setColor(0xcc6600)
                .setTitle('👋 Участник вышел или был кикнут')
                .addFields({ name: 'Участник', value: `${member.user.tag} (${member.id})` })
                .setTimestamp()
        );
    });

    client.on('channelCreate', async ch => {
        if (!ch.guild) return;
        if (await wasDoneByBot(ch.guild, AuditLogEvent.ChannelCreate, ch.id)) return;
        safeLog(
            ch.guild,
            new EmbedBuilder().setColor(0x00cc66).setTitle('📁 Канал создан').addFields({ name: 'Канал', value: `${ch.name}` }).setTimestamp()
        );
    });

    client.on('roleCreate', async role => {
        if (await wasDoneByBot(role.guild, AuditLogEvent.RoleCreate, role.id)) return;
        safeLog(
            role.guild,
            new EmbedBuilder().setColor(0x00cc66).setTitle('🏷️ Роль создана').addFields({ name: 'Роль', value: role.name }).setTimestamp()
        );
    });
}

module.exports = { register };
