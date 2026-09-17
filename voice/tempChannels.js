const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const { load, update } = require('./config');
const { errorEmbed } = require('../utils/embeds');

const DIRECT_BUTTON_IDS = ['tempvoice_lock', 'tempvoice_hide', 'tempvoice_rename', 'tempvoice_limit'];
const SELECT_BUTTON_IDS = ['tempvoice_kick', 'tempvoice_block', 'tempvoice_unblock', 'tempvoice_transfer'];
const ALL_BUTTON_IDS = [...DIRECT_BUTTON_IDS, ...SELECT_BUTTON_IDS];

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

function isOwnerOrStaff(entry, member) {
    if (entry.ownerId === member.id) return true;
    return member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ModerateMembers);
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
    if (!isOwnerOrStaff(entry, interaction.member)) {
        return { error: 'Только владелец комнаты или модератор может ей управлять.' };
    }
    const channel = interaction.guild.channels.cache.get(voiceChannelId);
    if (!channel) {
        return { error: 'Комната не найдена.' };
    }
    return { channel, entry };
}

function buildPanelMessage() {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
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
        new ButtonBuilder().setCustomId('tempvoice_lock').setEmoji({ id: CUSTOM_ICONS.lock, name: 'icon_lock' }).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_hide').setEmoji({ id: CUSTOM_ICONS.hide, name: 'icon_hide' }).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_rename').setEmoji({ id: CUSTOM_ICONS.edit, name: 'icon_edit' }).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_limit').setEmoji({ id: CUSTOM_ICONS.limit, name: 'icon_limit' }).setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tempvoice_kick').setEmoji({ id: CUSTOM_ICONS.kick, name: 'icon_kick' }).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_block').setEmoji({ id: CUSTOM_ICONS.block, name: 'icon_block' }).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_unblock').setEmoji({ id: CUSTOM_ICONS.unlock, name: 'icon_unlock' }).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('tempvoice_transfer').setEmoji({ id: CUSTOM_ICONS.crown, name: 'icon_crown' }).setStyle(ButtonStyle.Secondary)
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
        return;
    }

    if (entry.ownerId === oldState.member.id) {
        const nextMember = channel.members.first();
        if (nextMember) {
            await transferOwnership(channel, entry, nextMember.id);
        }
    }
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

async function handleButton(interaction) {
    if (!ALL_BUTTON_IDS.includes(interaction.customId)) return false;

    const config = await load();
    const target = resolveTarget(interaction, config);
    if (target.error) {
        await interaction.reply({ embeds: [errorEmbed(target.error)], ephemeral: true });
        return true;
    }
    const { channel, entry } = target;
    const everyone = interaction.guild.roles.everyone;

    if (interaction.customId === 'tempvoice_lock') {
        const current = channel.permissionOverwrites.cache.get(everyone.id);
        const isLocked = current?.deny.has(PermissionFlagsBits.Connect) ?? false;
        await channel.permissionOverwrites.edit(everyone, { Connect: isLocked ? null : false });
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setDescription(isLocked ? `Комната **${channel.name}** открыта для всех.` : `Комната **${channel.name}** закрыта.`),
            ],
            ephemeral: true,
        });
        return true;
    }

    if (interaction.customId === 'tempvoice_hide') {
        const current = channel.permissionOverwrites.cache.get(everyone.id);
        const isHidden = current?.deny.has(PermissionFlagsBits.ViewChannel) ?? false;
        await channel.permissionOverwrites.edit(everyone, { ViewChannel: isHidden ? null : false });
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setDescription(isHidden ? `Комната **${channel.name}** снова видна всем.` : `Комната **${channel.name}** скрыта из списка каналов.`),
            ],
            ephemeral: true,
        });
        return true;
    }

    if (interaction.customId === 'tempvoice_rename') {
        const modal = new ModalBuilder().setCustomId('tempvoice_modal_rename').setTitle('Переименовать комнату');
        const input = new TextInputBuilder()
            .setCustomId('tempvoice_rename_input')
            .setLabel('Новое название')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(95)
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return true;
    }

    if (interaction.customId === 'tempvoice_limit') {
        const modal = new ModalBuilder().setCustomId('tempvoice_modal_limit').setTitle('Лимит участников');
        const input = new TextInputBuilder()
            .setCustomId('tempvoice_limit_input')
            .setLabel('Число от 0 до 99 (0 = без лимита)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(2)
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return true;
    }

    if (interaction.customId === 'tempvoice_kick') {
        const select = new UserSelectMenuBuilder()
            .setCustomId('tempvoice_kick_select')
            .setPlaceholder('Кого отключить от канала?')
            .setMinValues(1)
            .setMaxValues(1);
        await interaction.reply({
            content: `Выбери участника, чтобы отключить его от комнаты «${channel.name}»:`,
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true,
        });
        return true;
    }

    if (interaction.customId === 'tempvoice_block') {
        const select = new UserSelectMenuBuilder()
            .setCustomId('tempvoice_block_select')
            .setPlaceholder('Кого заблокировать?')
            .setMinValues(1)
            .setMaxValues(1);
        await interaction.reply({
            content: `Выбери, кому запретить заходить в «${channel.name}»:`,
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true,
        });
        return true;
    }

    if (interaction.customId === 'tempvoice_unblock') {
        const blocked = channel.permissionOverwrites.cache.filter(
            ow => ow.id !== everyone.id && ow.id !== entry.ownerId && ow.deny.has(PermissionFlagsBits.Connect)
        );
        if (blocked.size === 0) {
            await interaction.reply({ embeds: [errorEmbed('В этой комнате никто не заблокирован.')], ephemeral: true });
            return true;
        }
        const options = blocked
            .map(ow => {
                const user = interaction.guild.members.cache.get(ow.id)?.user ?? interaction.client.users.cache.get(ow.id);
                return { label: user ? user.tag : ow.id, value: ow.id };
            })
            .slice(0, 25);
        const select = new StringSelectMenuBuilder().setCustomId('tempvoice_unblock_select').setPlaceholder('Кого разблокировать?').addOptions(options);
        await interaction.reply({
            content: `Выбери, кого разблокировать в «${channel.name}»:`,
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true,
        });
        return true;
    }

    if (interaction.customId === 'tempvoice_transfer') {
        const select = new UserSelectMenuBuilder()
            .setCustomId('tempvoice_transfer_select')
            .setPlaceholder('Кому передать права владельца?')
            .setMinValues(1)
            .setMaxValues(1);
        await interaction.reply({
            content: `Выбери нового владельца комнаты «${channel.name}»:`,
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true,
        });
        return true;
    }

    return false;
}

async function handleModalSubmit(interaction) {
    const modalIds = ['tempvoice_modal_rename', 'tempvoice_modal_limit'];
    if (!modalIds.includes(interaction.customId)) return false;

    const config = await load();
    const target = resolveTarget(interaction, config);
    if (target.error) {
        await interaction.reply({ embeds: [errorEmbed(target.error)], ephemeral: true });
        return true;
    }
    const { channel } = target;

    if (interaction.customId === 'tempvoice_modal_rename') {
        const name = interaction.fields.getTextInputValue('tempvoice_rename_input').trim();
        await channel.setName(name).catch(() => {});
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Комната переименована в **${name}**.`)],
            ephemeral: true,
        });
        return true;
    }

    if (interaction.customId === 'tempvoice_modal_limit') {
        const raw = interaction.fields.getTextInputValue('tempvoice_limit_input').trim();
        const limit = Number(raw);
        if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
            await interaction.reply({ embeds: [errorEmbed('Введи целое число от 0 до 99.')], ephemeral: true });
            return true;
        }
        await channel.setUserLimit(limit).catch(() => {});
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x57f287)
                    .setDescription(`Лимит участников комнаты «${channel.name}»: ${limit === 0 ? 'без ограничений' : limit}.`),
            ],
            ephemeral: true,
        });
        return true;
    }

    return false;
}

async function handleSelectMenu(interaction) {
    const selectIds = ['tempvoice_kick_select', 'tempvoice_block_select', 'tempvoice_unblock_select', 'tempvoice_transfer_select'];
    if (!selectIds.includes(interaction.customId)) return false;

    const config = await load();
    const target = resolveTarget(interaction, config);
    if (target.error) {
        await interaction.reply({ embeds: [errorEmbed(target.error)], ephemeral: true });
        return true;
    }
    const { channel, entry } = target;
    const targetId = interaction.values[0];

    if (interaction.customId === 'tempvoice_kick_select') {
        const targetMember = channel.members.get(targetId);
        if (!targetMember) {
            await interaction.reply({ embeds: [errorEmbed('Этого участника нет в твоей комнате.')], ephemeral: true });
            return true;
        }
        await targetMember.voice.disconnect('Отключён владельцем комнаты').catch(() => {});
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`${targetMember} отключён от комнаты «${channel.name}».`)],
            ephemeral: true,
        });
        return true;
    }

    if (interaction.customId === 'tempvoice_block_select') {
        if (targetId === entry.ownerId) {
            await interaction.reply({ embeds: [errorEmbed('Нельзя заблокировать самого себя.')], ephemeral: true });
            return true;
        }
        await channel.permissionOverwrites.edit(targetId, { Connect: false, ViewChannel: false }).catch(() => {});
        const memberInChannel = channel.members.get(targetId);
        if (memberInChannel) {
            await memberInChannel.voice.disconnect('Заблокирован владельцем комнаты').catch(() => {});
        }
        const user = interaction.guild.members.cache.get(targetId)?.user ?? interaction.client.users.cache.get(targetId);
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`${user ?? 'Участник'} заблокирован в комнате «${channel.name}».`)],
            ephemeral: true,
        });
        return true;
    }

    if (interaction.customId === 'tempvoice_unblock_select') {
        await channel.permissionOverwrites.delete(targetId).catch(() => {});
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x57f287).setDescription('Блокировка снята.')],
            ephemeral: true,
        });
        return true;
    }

    if (interaction.customId === 'tempvoice_transfer_select') {
        if (targetId === entry.ownerId) {
            await interaction.reply({ embeds: [errorEmbed('Ты уже владелец этой комнаты.')], ephemeral: true });
            return true;
        }
        await transferOwnership(channel, entry, targetId);
        const user = interaction.guild.members.cache.get(targetId)?.user ?? interaction.client.users.cache.get(targetId);
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Владельцем комнаты «${channel.name}» теперь ${user ?? 'выбранный участник'}.`)],
            ephemeral: true,
        });
        return true;
    }

    return false;
}

function register(client) {
    client.on('voiceStateUpdate', (oldState, newState) => {
        handleVoiceStateUpdate(oldState, newState).catch(err => console.error('tempVoice:', err));
    });
}

module.exports = { register, handleButton, handleModalSubmit, handleSelectMenu, buildPanelMessage };
