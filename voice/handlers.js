// Роутинг Discord-взаимодействий временных голосовых комнат: карты
// customId -> обработчик вместо цепочки if/else, вся доменная работа
// (переключение лока, кик, блок и т.д.) делегирована в voice/model.js.
const {
    EmbedBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const { load } = require('./config');
const { errorEmbed } = require('../utils/embeds');
const model = require('./model');

function resolveUser(interaction, targetId) {
    return interaction.guild.members.cache.get(targetId)?.user ?? interaction.client.users.cache.get(targetId);
}

// Общая для всех кнопок/select-меню/модалок этой фичи проверка: "ты
// сейчас в своей временной комнате (или модератор), и она существует?"
// Раньше жила один раз перед веткой if в каждом из трёх handle*, теперь
// оборачивает каждый обработчик, чтобы каждый оставался самостоятельным.
function withTarget(handler) {
    return async interaction => {
        const config = await load();
        const target = model.resolveTarget(interaction, config);
        if (target.error) {
            await interaction.reply({ embeds: [errorEmbed(target.error)], ephemeral: true });
            return;
        }
        await handler(interaction, target.channel, target.entry);
    };
}

// --- Кнопки на панели управления ---

const handleLockButton = withTarget(async (interaction, channel) => {
    const everyone = interaction.guild.roles.everyone;
    const { wasLocked } = await model.toggleLock(channel, everyone);
    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0x5865f2)
                .setDescription(
                    wasLocked ? `Комната **${channel.name}** открыта для всех.` : `Комната **${channel.name}** закрыта.`
                ),
        ],
        ephemeral: true,
    });
});

const handleHideButton = withTarget(async (interaction, channel) => {
    const everyone = interaction.guild.roles.everyone;
    const { wasHidden } = await model.toggleHide(channel, everyone);
    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0x5865f2)
                .setDescription(
                    wasHidden
                        ? `Комната **${channel.name}** снова видна всем.`
                        : `Комната **${channel.name}** скрыта из списка каналов.`
                ),
        ],
        ephemeral: true,
    });
});

const handleRenameButton = withTarget(async interaction => {
    const modal = new ModalBuilder().setCustomId('tempvoice_modal_rename').setTitle('Переименовать комнату');
    const input = new TextInputBuilder()
        .setCustomId('tempvoice_rename_input')
        .setLabel('Новое название')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(95)
        .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
});

const handleLimitButton = withTarget(async interaction => {
    const modal = new ModalBuilder().setCustomId('tempvoice_modal_limit').setTitle('Лимит участников');
    const input = new TextInputBuilder()
        .setCustomId('tempvoice_limit_input')
        .setLabel('Число от 0 до 99 (0 = без лимита)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(2)
        .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
});

const handleKickButton = withTarget(async (interaction, channel) => {
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
});

const handleBlockButton = withTarget(async (interaction, channel) => {
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
});

const handleUnblockButton = withTarget(async (interaction, channel, entry) => {
    const everyoneId = interaction.guild.roles.everyone.id;
    const blockedIds = model.getBlockedMemberIds(channel, entry, everyoneId);
    if (blockedIds.length === 0) {
        await interaction.reply({ embeds: [errorEmbed('В этой комнате никто не заблокирован.')], ephemeral: true });
        return;
    }
    const options = blockedIds
        .map(id => {
            const user = resolveUser(interaction, id);
            return { label: user ? user.tag : id, value: id };
        })
        .slice(0, 25);
    const select = new StringSelectMenuBuilder()
        .setCustomId('tempvoice_unblock_select')
        .setPlaceholder('Кого разблокировать?')
        .addOptions(options);
    await interaction.reply({
        content: `Выбери, кого разблокировать в «${channel.name}»:`,
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
    });
});

const handleTransferButton = withTarget(async (interaction, channel) => {
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
});

const BUTTON_HANDLERS = {
    tempvoice_lock: handleLockButton,
    tempvoice_hide: handleHideButton,
    tempvoice_rename: handleRenameButton,
    tempvoice_limit: handleLimitButton,
    tempvoice_kick: handleKickButton,
    tempvoice_block: handleBlockButton,
    tempvoice_unblock: handleUnblockButton,
    tempvoice_transfer: handleTransferButton,
};

async function handleButton(interaction) {
    const handler = BUTTON_HANDLERS[interaction.customId];
    if (!handler) return false;
    await handler(interaction);
    return true;
}

// --- Модалки (переименование/лимит) ---

const handleRenameModal = withTarget(async (interaction, channel) => {
    const name = interaction.fields.getTextInputValue('tempvoice_rename_input').trim();
    await model.renameRoom(channel, name);
    await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`Комната переименована в **${name}**.`)],
        ephemeral: true,
    });
});

const handleLimitModal = withTarget(async (interaction, channel) => {
    const raw = interaction.fields.getTextInputValue('tempvoice_limit_input').trim();
    const limit = Number(raw);
    if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
        await interaction.reply({ embeds: [errorEmbed('Введи целое число от 0 до 99.')], ephemeral: true });
        return;
    }
    await model.setRoomLimit(channel, limit);
    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0x57f287)
                .setDescription(
                    `Лимит участников комнаты «${channel.name}»: ${limit === 0 ? 'без ограничений' : limit}.`
                ),
        ],
        ephemeral: true,
    });
});

const MODAL_HANDLERS = {
    tempvoice_modal_rename: handleRenameModal,
    tempvoice_modal_limit: handleLimitModal,
};

async function handleModalSubmit(interaction) {
    const handler = MODAL_HANDLERS[interaction.customId];
    if (!handler) return false;
    await handler(interaction);
    return true;
}

// --- Select-меню (выбор конкретного участника после кнопки) ---

const handleKickSelect = withTarget(async (interaction, channel) => {
    const targetId = interaction.values[0];
    const targetMember = channel.members.get(targetId);
    if (!targetMember) {
        await interaction.reply({ embeds: [errorEmbed('Этого участника нет в твоей комнате.')], ephemeral: true });
        return;
    }
    await model.kickFromRoom(targetMember);
    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0x57f287)
                .setDescription(`${targetMember} отключён от комнаты «${channel.name}».`),
        ],
        ephemeral: true,
    });
});

const handleBlockSelect = withTarget(async (interaction, channel, entry) => {
    const targetId = interaction.values[0];
    if (targetId === entry.ownerId) {
        await interaction.reply({ embeds: [errorEmbed('Нельзя заблокировать самого себя.')], ephemeral: true });
        return;
    }
    await model.blockInRoom(channel, targetId);
    const user = resolveUser(interaction, targetId);
    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0x57f287)
                .setDescription(`${user ?? 'Участник'} заблокирован в комнате «${channel.name}».`),
        ],
        ephemeral: true,
    });
});

const handleUnblockSelect = withTarget(async (interaction, channel) => {
    const targetId = interaction.values[0];
    await model.unblockInRoom(channel, targetId);
    await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x57f287).setDescription('Блокировка снята.')],
        ephemeral: true,
    });
});

const handleTransferSelect = withTarget(async (interaction, channel, entry) => {
    const targetId = interaction.values[0];
    if (targetId === entry.ownerId) {
        await interaction.reply({ embeds: [errorEmbed('Ты уже владелец этой комнаты.')], ephemeral: true });
        return;
    }
    await model.transferOwnership(channel, entry, targetId);
    const user = resolveUser(interaction, targetId);
    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0x57f287)
                .setDescription(`Владельцем комнаты «${channel.name}» теперь ${user ?? 'выбранный участник'}.`),
        ],
        ephemeral: true,
    });
});

const SELECT_MENU_HANDLERS = {
    tempvoice_kick_select: handleKickSelect,
    tempvoice_block_select: handleBlockSelect,
    tempvoice_unblock_select: handleUnblockSelect,
    tempvoice_transfer_select: handleTransferSelect,
};

async function handleSelectMenu(interaction) {
    const handler = SELECT_MENU_HANDLERS[interaction.customId];
    if (!handler) return false;
    await handler(interaction);
    return true;
}

function register(client) {
    client.on('voiceStateUpdate', (oldState, newState) => {
        model.handleVoiceStateUpdate(oldState, newState).catch(err => console.error('tempVoice:', err));
    });
}

module.exports = { register, handleButton, handleModalSubmit, handleSelectMenu };
