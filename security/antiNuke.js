const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { load, isTrusted } = require('./config');
const { log, alertOwner } = require('./logger');
const { COLORS, baseEmbed, criticalEmbed } = require('../utils/embeds');

const DANGEROUS_PERMS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
];

const actionLog = new Map();
const processedEntries = new Set();

function recordAction(userId) {
    const arr = actionLog.get(userId) ?? [];
    arr.push(Date.now());
    actionLog.set(userId, arr);
}

function countRecent(userId, windowMs) {
    const now = Date.now();
    const arr = (actionLog.get(userId) ?? []).filter(ts => now - ts <= windowMs);
    actionLog.set(userId, arr);
    return arr.length;
}

async function getExecutor(guild, type, targetId) {
    try {
        const logs = await guild.fetchAuditLogs({ type, limit: 5 });
        const entry = logs.entries.find(e => e.target?.id === targetId && Date.now() - e.createdTimestamp < 8000);
        if (!entry || processedEntries.has(entry.id)) return null;
        processedEntries.add(entry.id);
        setTimeout(() => processedEntries.delete(entry.id), 30000);
        return entry.executor;
    } catch (err) {
        console.error('antiNuke: не удалось прочитать audit log:', err.message);
        return null;
    }
}

async function punish(guild, userId, reason) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return { rolesStripped: false, banned: false };

    let rolesStripped = false;
    let banned = false;

    try {
        const rolesToRemove = member.roles.cache.filter(r => r.id !== guild.roles.everyone.id);
        if (rolesToRemove.size && member.manageable) {
            await member.roles.remove(rolesToRemove, reason);
            rolesStripped = true;
        }
    } catch (err) {
        console.error('antiNuke: не удалось снять роли:', err.message);
    }

    try {
        if (member.bannable) {
            await member.ban({ reason });
            banned = true;
        }
    } catch (err) {
        console.error('antiNuke: не удалось забанить:', err.message);
    }

    return { rolesStripped, banned };
}

async function handleDestructiveAction(guild, auditType, targetId, description) {
    const config = await load();
    if (!config.antiNuke.enabled) return;

    const executor = await getExecutor(guild, auditType, targetId);
    if (!executor || executor.bot) return;
    if (await isTrusted(guild, executor.id)) return;

    recordAction(executor.id);
    const count = countRecent(executor.id, config.antiNuke.windowMs);

    await log(
        guild,
        baseEmbed(COLORS.warning)
            .setTitle('Anti-nuke: подозрительное действие')
            .addFields(
                { name: 'Действие', value: description },
                { name: 'Исполнитель', value: `${executor.tag} (${executor.id})` },
                { name: 'Событий за окно', value: `${count}/${config.antiNuke.maxActions}` }
            )
    );

    if (count >= config.antiNuke.maxActions) {
        const result = await punish(guild, executor.id, 'Anti-nuke: превышен лимит разрушительных действий');
        await log(
            guild,
            criticalEmbed(
                `Пользователь ${executor.tag} (${executor.id}) превысил лимит разрушительных действий.\n` +
                    `Роли сняты: ${result.rolesStripped ? 'да' : 'нет'}. Забанен: ${result.banned ? 'да' : 'нет (не удалось — проверь вручную)'}.`,
                'Anti-nuke сработал'
            )
        );
        await alertOwner(
            guild,
            'Anti-nuke сработал',
            `На сервере **${guild.name}**: ${executor.tag} (${executor.id}) нейтрализован после ${count} разрушительных действий подряд.` +
                (result.banned ? '' : '\n\nВНИМАНИЕ: забанить автоматически не удалось, проверь права/роли вручную.')
        );
    }
}

async function handleDangerousRole(role, isNew, oldPermissions) {
    const config = await load();
    if (!config.antiNuke.enabled) return;

    const hasDangerous = DANGEROUS_PERMS.some(p => role.permissions.has(p));
    if (!hasDangerous) return;
    if (!isNew) {
        const hadBefore = DANGEROUS_PERMS.some(p => oldPermissions.has(p));
        if (hadBefore) return; // не новое усиление прав
    }

    const executor = await getExecutor(
        role.guild,
        isNew ? AuditLogEvent.RoleCreate : AuditLogEvent.RoleUpdate,
        role.id
    );
    if (!executor || executor.bot) return;
    if (await isTrusted(role.guild, executor.id)) return;

    if (isNew) {
        await role.delete('Anti-nuke: роль создана с опасными правами').catch(() => {});
    } else {
        await role.setPermissions(oldPermissions, 'Anti-nuke: откат опасных прав').catch(() => {});
    }

    await log(
        role.guild,
        baseEmbed(COLORS.critical)
            .setTitle('Anti-nuke: попытка повышения прав')
            .addFields(
                { name: 'Роль', value: role.name },
                { name: 'Исполнитель', value: `${executor.tag} (${executor.id})` },
                { name: 'Действие', value: isNew ? 'Роль удалена' : 'Права откачены' }
            )
    );

    recordAction(executor.id);
    const count = countRecent(executor.id, config.antiNuke.windowMs);
    if (count >= config.antiNuke.maxActions) {
        const result = await punish(role.guild, executor.id, 'Anti-nuke: попытка повышения прав');
        await alertOwner(
            role.guild,
            'Anti-nuke сработал',
            `На сервере **${role.guild.name}**: ${executor.tag} (${executor.id}) пытался выдать себе опасные права и был нейтрализован (роли сняты: ${result.rolesStripped}, бан: ${result.banned}).`
        );
    } else {
        await alertOwner(
            role.guild,
            'Попытка повышения прав',
            `На сервере **${role.guild.name}** пользователь ${executor.tag} (${executor.id}) попытался выдать опасные права роли "${role.name}". Действие отменено.`
        );
    }
}

function register(client) {
    client.on('channelDelete', ch => {
        if (!ch.guild) return;
        handleDestructiveAction(ch.guild, AuditLogEvent.ChannelDelete, ch.id, `Удаление канала #${ch.name}`).catch(
            err => console.error('antiNuke:', err)
        );
    });

    client.on('roleDelete', role => {
        handleDestructiveAction(role.guild, AuditLogEvent.RoleDelete, role.id, `Удаление роли ${role.name}`).catch(
            err => console.error('antiNuke:', err)
        );
    });

    client.on('guildBanAdd', ban => {
        handleDestructiveAction(
            ban.guild,
            AuditLogEvent.MemberBanAdd,
            ban.user.id,
            `Бан участника ${ban.user.tag}`
        ).catch(err => console.error('antiNuke:', err));
    });

    client.on('roleCreate', role => {
        handleDangerousRole(role, true, null).catch(err => console.error('antiNuke:', err));
    });

    client.on('roleUpdate', (oldRole, newRole) => {
        handleDangerousRole(newRole, false, oldRole.permissions).catch(err => console.error('antiNuke:', err));
    });
}

module.exports = { register };
