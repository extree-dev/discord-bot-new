// Доменный слой временных голосовых комнат: кто ими может управлять,
// создание/передача владения/уборка при выходе, сами действия над
// каналом (лок, скрытие, лимит, кик, блок). Роутинг по customId — в
// voice/handlers.js.
const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { load, update } = require('./config');
const { COLORS, baseEmbed } = require('../utils/embeds');

// Кастомные иконки (Application Emoji), загружены с icons8.com
const CUSTOM_ICONS = {
    lock: '1549165711094718526',
    hide: '1549165712327704586',
    edit: '1549165713992712255',
    limit: '1549165715754328136',
    block: '1549165718258458715',
    unlock: '1549165720892350484',
    crown: '1549165722570203250',
    kick: '1549165725623779449',
};

// Для channel.permissionOverwrites.edit() — объект { флаг: true/false/null }
function ownerPermissions() {
    return {
        ViewChannel: true,
        Connect: true,
        ManageChannels: true,
        MoveMembers: true,
        MuteMembers: true,
        DeafenMembers: true,
    };
}

// Для guild.channels.create({ permissionOverwrites }) — allow/deny там ждут массив флагов, а не объект
const OWNER_PERMISSION_FLAGS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.MoveMembers,
    PermissionFlagsBits.MuteMembers,
    PermissionFlagsBits.DeafenMembers,
];

function isOwner(entry, member) {
    return entry.ownerId === member.id;
}

function resolveTarget(interaction, config) {
    const voiceChannelId = interaction.member.voice.channelId;
    if (!voiceChannelId) {
        return { error: 'Зайди в свою временную комнату (в голосовой канал), чтобы ей управлять.' };
    }
    const entry = config.channels[voiceChannelId];
    if (!entry) {
        return { error: 'Ты сейчас не в временной комнате.' };
    }
    if (!isOwner(entry, interaction.member)) {
        return { error: 'Только владелец комнаты может ей управлять.' };
    }
    const channel = interaction.guild.channels.cache.get(voiceChannelId);
    if (!channel) {
        return { error: 'Комната не найдена.' };
    }
    return { channel, entry };
}

function buildPanelMessage() {
    const embed = baseEmbed(COLORS.primary)
        .setTitle('Управление временной комнатой')
        .setDescription(
            'Зайди в свою комнату в голосовом канале и жми кнопки — действие применится к ней.\n\n' +
                [
                    `<:icon_lock:${CUSTOM_ICONS.lock}> \`Закрыть/Открыть — запретить или разрешить вход в комнату\``,
                    `<:icon_hide:${CUSTOM_ICONS.hide}> \`Скрыть/Показать — убрать комнату из списка каналов или вернуть обратно\``,
                    `<:icon_edit:${CUSTOM_ICONS.edit}> \`Переименовать — задать своё название комнаты\``,
                    `<:icon_limit:${CUSTOM_ICONS.limit}> \`Лимит — ограничить число участников в комнате\``,
                    `<:icon_kick:${CUSTOM_ICONS.kick}> \`Кикнуть — отключить участника от комнаты\``,
                    `<:icon_block:${CUSTOM_ICONS.block}> \`Заблокировать — запретить конкретному человеку заходить\``,
                    `<:icon_unlock:${CUSTOM_ICONS.unlock}> \`Разблокировать — снять блокировку с человека\``,
                    `<:icon_crown:${CUSTOM_ICONS.crown}> \`Передать права — сделать другого участника владельцем\``,
                ].join('\n')
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('tempvoice_lock')
            .setEmoji({ id: CUSTOM_ICONS.lock, name: 'icon_lock' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_hide')
            .setEmoji({ id: CUSTOM_ICONS.hide, name: 'icon_hide' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_rename')
            .setEmoji({ id: CUSTOM_ICONS.edit, name: 'icon_edit' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_limit')
            .setEmoji({ id: CUSTOM_ICONS.limit, name: 'icon_limit' })
            .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('tempvoice_kick')
            .setEmoji({ id: CUSTOM_ICONS.kick, name: 'icon_kick' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_block')
            .setEmoji({ id: CUSTOM_ICONS.block, name: 'icon_block' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_unblock')
            .setEmoji({ id: CUSTOM_ICONS.unlock, name: 'icon_unlock' })
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('tempvoice_transfer')
            .setEmoji({ id: CUSTOM_ICONS.crown, name: 'icon_crown' })
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2] };
}

async function createRoom(state, config) {
    const guild = state.guild;
    const member = state.member;
    const category = config.categoryId ? guild.channels.cache.get(config.categoryId) : null;

    const name = `Комната ${member.displayName}`.slice(0, 95);

    const overwrites = category
        ? category.permissionOverwrites.cache.map(ow => ({ id: ow.id, allow: ow.allow, deny: ow.deny, type: ow.type }))
        : [];
    overwrites.push({ id: member.id, allow: OWNER_PERMISSION_FLAGS });

    const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent: category?.id ?? null,
        userLimit: config.defaultLimit,
        permissionOverwrites: overwrites,
    });

    await member.voice.setChannel(channel).catch(err => {
        console.error('tempVoice: не удалось переместить участника в новую комнату:', err.message);
    });

    // Не пишем через переданный `config` — он был загружен до await'ов
    // выше (создание канала, перемещение участника) и может быть уже
    // устаревшим. update() перечитывает файл заново перед записью.
    await update(cfg => {
        cfg.channels[channel.id] = { ownerId: member.id, createdAt: Date.now() };
    });
}

async function transferOwnership(channel, entry, newOwnerId) {
    await channel.permissionOverwrites.delete(entry.ownerId).catch(() => {});
    await channel.permissionOverwrites.edit(newOwnerId, ownerPermissions()).catch(() => {});
    entry.ownerId = newOwnerId;

    await update(cfg => {
        if (cfg.channels[channel.id]) cfg.channels[channel.id].ownerId = newOwnerId;
    });
}

async function handleLeave(oldState) {
    const config = await load();
    const channelId = oldState.channelId;
    const entry = config.channels[channelId];
    if (!entry) return;

    const channel = oldState.guild.channels.cache.get(channelId);
    if (!channel) {
        await update(cfg => {
            delete cfg.channels[channelId];
        });
        return;
    }

    if (channel.members.size === 0) {
        await update(cfg => {
            delete cfg.channels[channelId];
        });
        await channel.delete('Временная комната пуста').catch(() => {});
    }

    // Владение НЕ передаётся автоматически, когда владелец выходит из
    // комнаты (даже временно) — иначе любой, кто остался в канале в
    // этот момент, получал бы полный контроль без согласия владельца.
    // Осознанная передача прав — через кнопку "Передать права"
    // (tempvoice_transfer), которая вызывает transferOwnership() явно.
}

async function handleVoiceStateUpdate(oldState, newState) {
    if (newState.member?.user.bot) return;
    const config = await load();
    if (!config.triggerChannelId) return;

    if (newState.channelId === config.triggerChannelId && oldState.channelId !== config.triggerChannelId) {
        await createRoom(newState, config);
    }

    if (oldState.channelId && oldState.channelId !== newState.channelId) {
        await handleLeave(oldState);
    }
}

// --- Действия над уже найденной комнатой (channel/entry резолвит
// resolveTarget в handlers.js) — каждая возвращает данные, нужные для
// текста ответа, но сам interaction.reply() остаётся в handlers.js.

async function toggleLock(channel, everyoneRole) {
    const current = channel.permissionOverwrites.cache.get(everyoneRole.id);
    const wasLocked = current?.deny.has(PermissionFlagsBits.Connect) ?? false;
    await channel.permissionOverwrites.edit(everyoneRole, { Connect: wasLocked ? null : false });
    return { wasLocked };
}

async function toggleHide(channel, everyoneRole) {
    const current = channel.permissionOverwrites.cache.get(everyoneRole.id);
    const wasHidden = current?.deny.has(PermissionFlagsBits.ViewChannel) ?? false;
    await channel.permissionOverwrites.edit(everyoneRole, { ViewChannel: wasHidden ? null : false });
    return { wasHidden };
}

async function renameRoom(channel, name) {
    await channel.setName(name).catch(() => {});
}

async function setRoomLimit(channel, limit) {
    await channel.setUserLimit(limit).catch(() => {});
}

async function kickFromRoom(targetMember) {
    await targetMember.voice.disconnect('Отключён владельцем комнаты').catch(() => {});
}

async function blockInRoom(channel, targetId) {
    await channel.permissionOverwrites.edit(targetId, { Connect: false, ViewChannel: false }).catch(() => {});
    const memberInChannel = channel.members.get(targetId);
    if (memberInChannel) {
        await memberInChannel.voice.disconnect('Заблокирован владельцем комнаты').catch(() => {});
    }
}

async function unblockInRoom(channel, targetId) {
    await channel.permissionOverwrites.delete(targetId).catch(() => {});
}

// ID заблокированных участников комнаты (без @everyone и без владельца) —
// handlers.js сам резолвит их в User для подписи пунктов select-меню.
function getBlockedMemberIds(channel, entry, everyoneId) {
    return channel.permissionOverwrites.cache
        .filter(ow => ow.id !== everyoneId && ow.id !== entry.ownerId && ow.deny.has(PermissionFlagsBits.Connect))
        .map(ow => ow.id);
}

module.exports = {
    CUSTOM_ICONS,
    ownerPermissions,
    OWNER_PERMISSION_FLAGS,
    isOwner,
    resolveTarget,
    buildPanelMessage,
    createRoom,
    transferOwnership,
    handleLeave,
    handleVoiceStateUpdate,
    toggleLock,
    toggleHide,
    renameRoom,
    setRoomLimit,
    kickFromRoom,
    blockInRoom,
    unblockInRoom,
    getBlockedMemberIds,
};
