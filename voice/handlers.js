// Роутинг Discord-взаимодействий временных голосовых комнат: карты
// customId -> обработчик вместо цепочки if/else, вся доменная работа
// (переключение лока, кик, блок и т.д.) делегирована в voice/model.js.
const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
    MessageFlags,
} = require('discord.js');
const { load } = require('./config');
const security = require('../security');
const { COLORS, baseEmbed, formatBody, errorEmbed, successEmbed } = require('../utils/embeds');
const model = require('./model');

function resolveUser(interaction, targetId) {
    return interaction.guild.members.cache.get(targetId)?.user ?? interaction.client.users.cache.get(targetId);
}

// Общая для всех кнопок/select-меню/модалок этой фичи проверка: "ты
// сейчас в своей временной комнате, ты её владелец, и она существует?"
// Раньше жила один раз перед веткой if в каждом из трёх handle*, теперь
// оборачивает каждый обработчик, чтобы каждый оставался самостоятельным.
function withTarget(handler) {
    return async interaction => {
        const config = await load();
        const target = model.resolveTarget(interaction, config);
        if (target.error) {
            await interaction.reply({ embeds: [errorEmbed(target.error)], flags: MessageFlags.Ephemeral });
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
            baseEmbed(COLORS.primary).setDescription(
                formatBody(
                    wasLocked ? 'Комната открыта' : 'Комната закрыта',
                    wasLocked ? `Комната **${channel.name}** открыта для всех.` : `Комната **${channel.name}** закрыта.`
                )
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });
});

const handleHideButton = withTarget(async (interaction, channel) => {
    const everyone = interaction.guild.roles.everyone;
    const { wasHidden } = await model.toggleHide(channel, everyone);
    await interaction.reply({
        embeds: [
            baseEmbed(COLORS.primary).setDescription(
                formatBody(
                    wasHidden ? 'Комната видна' : 'Комната скрыта',
                    wasHidden
                        ? `Комната **${channel.name}** снова видна всем.`
                        : `Комната **${channel.name}** скрыта из списка каналов.`
                )
            ),
        ],
        flags: MessageFlags.Ephemeral,
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

// Меню из тех, кто сейчас в комнате (без владельца и ботов) — раньше
// UserSelect предлагал всех участников сервера, и большая часть пунктов
// заканчивалась ошибкой "его нет в комнате". Discord ограничивает меню 25
// пунктами — в комнате с лимитом до 99 показываем первых 25.
function roomMemberSelect(channel, entry, customId, placeholder) {
    const members = model.getRoomMembers(channel, entry);
    if (members.length === 0) return null;
    const options = members.slice(0, 25).map(m => ({
        label: m.displayName.slice(0, 100),
        description: m.user.tag.slice(0, 100),
        value: m.id,
    }));
    return new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options);
}

const handleKickButton = withTarget(async (interaction, channel, entry) => {
    const select = roomMemberSelect(channel, entry, 'tempvoice_kick_select', 'Кого отключить от канала?');
    if (!select) {
        await interaction.reply({
            embeds: [errorEmbed('В комнате нет никого, кроме тебя.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.reply({
        content: `Выбери участника, чтобы отключить его от комнаты «${channel.name}»:`,
        components: [new ActionRowBuilder().addComponents(select)],
        flags: MessageFlags.Ephemeral,
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
        flags: MessageFlags.Ephemeral,
    });
});

const handleUnblockButton = withTarget(async (interaction, channel, entry) => {
    const everyoneId = interaction.guild.roles.everyone.id;
    const blockedIds = model.getBlockedMemberIds(channel, entry, everyoneId);
    if (blockedIds.length === 0) {
        await interaction.reply({
            embeds: [errorEmbed('В этой комнате никто не заблокирован.')],
            flags: MessageFlags.Ephemeral,
        });
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
        flags: MessageFlags.Ephemeral,
    });
});

const handleTransferButton = withTarget(async (interaction, channel, entry) => {
    const select = roomMemberSelect(channel, entry, 'tempvoice_transfer_select', 'Кому передать права владельца?');
    if (!select) {
        await interaction.reply({
            embeds: [errorEmbed('Передать права можно только тому, кто сейчас в комнате.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.reply({
        content: `Выбери нового владельца комнаты «${channel.name}»:`,
        components: [new ActionRowBuilder().addComponents(select)],
        flags: MessageFlags.Ephemeral,
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
    const { bannedWords } = await security.getConfig();
    const invalid = model.validateRoomName(name, bannedWords);
    if (invalid) {
        await interaction.reply({ embeds: [errorEmbed(invalid)], flags: MessageFlags.Ephemeral });
        return;
    }
    const wait = model.renameWaitMs(channel.id);
    if (wait > 0) {
        await interaction.reply({
            embeds: [
                errorEmbed(
                    `Discord разрешает переименовать канал только 2 раза за 10 минут. Попробуй через ${Math.ceil(wait / 60000)} мин.`
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        await model.renameRoom(channel, name);
    } catch (err) {
        console.error('tempVoice: не удалось переименовать комнату:', err.message);
        await interaction.editReply({ embeds: [errorEmbed('Не удалось переименовать комнату. Попробуй позже.')] });
        return;
    }
    await interaction.editReply({
        embeds: [successEmbed(`Комната переименована в **${name}**.`, 'Комната переименована')],
    });
});

const handleLimitModal = withTarget(async (interaction, channel) => {
    const raw = interaction.fields.getTextInputValue('tempvoice_limit_input').trim();
    const limit = Number(raw);
    if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
        await interaction.reply({
            embeds: [errorEmbed('Введи целое число от 0 до 99.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        await model.setRoomLimit(channel, limit);
    } catch (err) {
        console.error('tempVoice: не удалось изменить лимит комнаты:', err.message);
        await interaction.reply({
            embeds: [errorEmbed('Не удалось изменить лимит. Попробуй позже.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.reply({
        embeds: [
            successEmbed(
                `Лимит участников комнаты «${channel.name}»: ${limit === 0 ? 'без ограничений' : limit}.`,
                'Лимит обновлён'
            ),
        ],
        flags: MessageFlags.Ephemeral,
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

const handleKickSelect = withTarget(async (interaction, channel, entry) => {
    const targetId = interaction.values[0];
    const targetMember = channel.members.get(targetId);
    if (!targetMember || targetMember.user.bot || targetId === entry.ownerId) {
        await interaction.reply({
            embeds: [errorEmbed('Этого участника нет в твоей комнате.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await model.kickFromRoom(targetMember);
    await interaction.reply({
        embeds: [successEmbed(`${targetMember} отключён от комнаты «${channel.name}».`, 'Участник отключён')],
        flags: MessageFlags.Ephemeral,
    });
});

const handleBlockSelect = withTarget(async (interaction, channel, entry) => {
    const targetId = interaction.values[0];
    if (targetId === entry.ownerId) {
        await interaction.reply({
            embeds: [errorEmbed('Нельзя заблокировать самого себя.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await model.blockInRoom(channel, targetId);
    const user = resolveUser(interaction, targetId);
    await interaction.reply({
        embeds: [
            successEmbed(`${user ?? 'Участник'} заблокирован в комнате «${channel.name}».`, 'Участник заблокирован'),
        ],
        flags: MessageFlags.Ephemeral,
    });
});

const handleUnblockSelect = withTarget(async (interaction, channel) => {
    const targetId = interaction.values[0];
    await model.unblockInRoom(channel, targetId);
    await interaction.reply({
        embeds: [successEmbed('Блокировка снята.', 'Блокировка снята')],
        flags: MessageFlags.Ephemeral,
    });
});

const handleTransferSelect = withTarget(async (interaction, channel, entry) => {
    const targetId = interaction.values[0];
    if (targetId === entry.ownerId) {
        await interaction.reply({
            embeds: [errorEmbed('Ты уже владелец этой комнаты.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    // Меню собрано на момент нажатия кнопки — за это время выбранный
    // участник мог уйти. Права получает только тот, кто всё ещё в комнате.
    const targetMember = channel.members.get(targetId);
    if (!targetMember || targetMember.user.bot) {
        await interaction.reply({
            embeds: [errorEmbed('Этого участника уже нет в твоей комнате.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await model.transferOwnership(channel, entry, targetId);
    const user = resolveUser(interaction, targetId);
    await interaction.reply({
        embeds: [
            successEmbed(
                `Владельцем комнаты «${channel.name}» теперь ${user ?? 'выбранный участник'}.`,
                'Права переданы'
            ),
        ],
        flags: MessageFlags.Ephemeral,
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
    model.startSweep(client);
    client.on('voiceStateUpdate', (oldState, newState) => {
        model.handleVoiceStateUpdate(oldState, newState).catch(err => console.error('tempVoice:', err));
    });
}

module.exports = { register, handleButton, handleModalSubmit, handleSelectMenu };
