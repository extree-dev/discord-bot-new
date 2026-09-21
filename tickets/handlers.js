// Роутинг Discord-взаимодействий тикетов: сопоставляет customId с
// обработчиком и делегирует всю доменную работу в tickets/model.js —
// здесь только разбор interaction'а и построение ответных сообщений.
const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} = require('discord.js');
const { load } = require('./config');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const model = require('./model');

const CREATE_MODAL_PREFIX = 'ticket_modal_create:';
const TARGET_SELECT_PREFIX = 'ticket_target_select:';
const DESCRIPTION_INPUT_ID = 'ticket_description_input';
const PUNISH_BUTTON_PREFIX = 'ticket_punish:';
const PUNISH_SELECT_PREFIX = 'ticket_punish_select:';
const UNPUNISH_BUTTON_PREFIX = 'ticket_unpunish:';

function buildCreateModal(reason, targetId = null) {
    const customId = targetId
        ? `${CREATE_MODAL_PREFIX}${reason.value}:${targetId}`
        : `${CREATE_MODAL_PREFIX}${reason.value}`;
    const modal = new ModalBuilder().setCustomId(customId).setTitle('Отправить обращение');

    const descriptionInput = new TextInputBuilder()
        .setCustomId(DESCRIPTION_INPUT_ID)
        .setLabel((reason.descriptionLabel ?? 'Опиши проблему подробно').slice(0, 45))
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true);
    if (reason.descriptionPlaceholder) descriptionInput.setPlaceholder(reason.descriptionPlaceholder.slice(0, 100));
    modal.addComponents(new ActionRowBuilder().addComponents(descriptionInput));
    return modal;
}

// Каждая тема на панели открывается своей кнопкой (см. tickets/model.js
// buildPanelMessage) — reasonValue зашит в customId кнопки. Темы с
// requiresTargetUser (сейчас — "Жалоба на игрока") сначала показывают
// UserSelectMenu — targetId попадёт в модалку уже выбранным, без
// текстового поля с ником/ID, который автор не всегда знает как достать.
async function handleOpenReasonButton(interaction) {
    const reasonValue = interaction.customId.slice(model.OPEN_REASON_PREFIX.length);
    const reason = model.REASONS.find(r => r.value === reasonValue) ?? model.REASONS[model.REASONS.length - 1];

    if (reason.requiresTargetUser) {
        const select = new UserSelectMenuBuilder()
            .setCustomId(`${TARGET_SELECT_PREFIX}${reason.value}`)
            .setPlaceholder('Кого касается жалоба?')
            .setMinValues(1)
            .setMaxValues(1);
        await interaction.reply({
            content: 'Выбери игрока, на которого жалуешься:',
            components: [new ActionRowBuilder().addComponents(select)],
            ephemeral: true,
        });
        return;
    }

    await interaction.showModal(buildCreateModal(reason));
}

async function handleTargetUserSelect(interaction) {
    const reasonValue = interaction.customId.slice(TARGET_SELECT_PREFIX.length);
    const reason = model.REASONS.find(r => r.value === reasonValue) ?? model.REASONS[model.REASONS.length - 1];
    const targetId = interaction.values[0];
    if (targetId === interaction.user.id) {
        await interaction.update({
            content: null,
            embeds: [errorEmbed('Нельзя пожаловаться на самого себя.')],
            components: [],
        });
        return;
    }
    await interaction.showModal(buildCreateModal(reason, targetId));
}

async function handleCreateModal(interaction) {
    // deferReply сразу, до любой асинхронной работы (фетч нарушителя для
    // report, отправка карточки в канал стафу) — тот же приём, что и
    // раньше: без него на медленной сети interaction протухает за 3
    // секунды, хотя форма всё равно успешно доходит в фоне.
    await interaction.deferReply({ ephemeral: true });

    try {
        const [reasonValue, targetId] = interaction.customId.slice(CREATE_MODAL_PREFIX.length).split(':');
        const reason = model.REASONS.find(r => r.value === reasonValue) ?? model.REASONS[model.REASONS.length - 1];
        const description = interaction.fields.getTextInputValue(DESCRIPTION_INPUT_ID).trim();

        // Тег снимаем один раз здесь (не <@id> в самой карточке — см.
        // model.formatReportedUser), чтобы дальше показывать нарушителя
        // без упоминания и без лишних фетчей из чистых билдеров.
        const reportedMember = targetId ? await interaction.guild.members.fetch(targetId).catch(() => null) : null;
        const result = await model.submitForm(interaction, reason, description, {
            targetId: targetId ?? null,
            targetTag: reportedMember?.user.tag ?? null,
        });
        if (result.error) {
            await interaction.editReply({ embeds: [errorEmbed(result.error)] });
            return;
        }
        await interaction.editReply({
            embeds: [successEmbed('Обращение отправлено команде поддержки — спасибо!', 'Готово')],
        });
    } catch (err) {
        console.error('tickets: не удалось обработать отправку формы:', err);
        await interaction
            .editReply({ embeds: [errorEmbed('Не получилось отправить обращение — попробуй ещё раз чуть позже.')] })
            .catch(() => {});
    }
}

// "Наказать" на карточке жалобы — targetId зашит в customId самой кнопки
// (нет отдельной записи "тикета", откуда его можно было бы прочитать).
async function handlePunishButton(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может применять наказания.')],
            ephemeral: true,
        });
        return;
    }
    const targetId = interaction.customId.slice(PUNISH_BUTTON_PREFIX.length);
    const select = new StringSelectMenuBuilder()
        .setCustomId(`${PUNISH_SELECT_PREFIX}${targetId}`)
        .setPlaceholder('Выбери наказание')
        .addOptions(
            { label: 'Мут на 10 минут', value: 'mute:600' },
            { label: 'Мут на 1 час', value: 'mute:3600' },
            { label: 'Мут на 1 день', value: 'mute:86400' },
            { label: 'Мут на 7 дней', value: 'mute:604800' },
            { label: 'Забанить', value: 'ban' }
        );
    await interaction.reply({
        content: 'Выбери наказание для нарушителя:',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
    });
}

async function handlePunishSelect(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.update({
            content: null,
            embeds: [errorEmbed('Нет доступа к применению наказаний.')],
            components: [],
        });
        return;
    }
    const targetId = interaction.customId.slice(PUNISH_SELECT_PREFIX.length);
    const action = interaction.values[0];
    const contextLabel = interaction.message?.url ?? 'карточка обращения';
    const result = await model.punishReportedUser(interaction, targetId, action, contextLabel);
    if (result.error) {
        await interaction.update({ content: null, embeds: [errorEmbed(result.error)], components: [] });
        return;
    }
    await interaction.update({
        content: null,
        embeds: [successEmbed(`${model.formatReportedUser(targetId, null)} — ${result.label}.`, 'Наказание применено')],
        components: [],
    });
}

// "Снять наказание" — только у карточек обжалования: ownerId (автор
// апелляции) зашит в customId. Обжаловать можно только мут (см.
// utils/punishmentNotice.js — уведомление о муте единственное, что несёт
// апелляционный смысл), поэтому кнопка всегда снимает мут именно с него.
async function handleUnpunishButton(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может снимать наказания.')],
            ephemeral: true,
        });
        return;
    }
    const ownerId = interaction.customId.slice(UNPUNISH_BUTTON_PREFIX.length);
    const result = await model.unpunishTicketOwner(interaction, ownerId);
    if (!result.wasMuted) {
        await interaction.reply({
            embeds: [errorEmbed(`<@${ownerId}> сейчас не замучен — снимать нечего.`)],
            ephemeral: true,
        });
        return;
    }
    await interaction.reply({
        embeds: [successEmbed(`Мут снят с <@${ownerId}>.`, 'Наказание снято')],
        ephemeral: true,
    });
}

async function handleButton(interaction) {
    if (interaction.customId.startsWith(model.OPEN_REASON_PREFIX)) {
        await handleOpenReasonButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(PUNISH_BUTTON_PREFIX)) {
        await handlePunishButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(UNPUNISH_BUTTON_PREFIX)) {
        await handleUnpunishButton(interaction);
        return true;
    }
    return false;
}

async function handleSelectMenu(interaction) {
    if (interaction.customId.startsWith(TARGET_SELECT_PREFIX)) {
        await handleTargetUserSelect(interaction);
        return true;
    }
    if (interaction.customId.startsWith(PUNISH_SELECT_PREFIX)) {
        await handlePunishSelect(interaction);
        return true;
    }
    return false;
}

async function handleModalSubmit(interaction) {
    if (interaction.customId.startsWith(CREATE_MODAL_PREFIX)) {
        await handleCreateModal(interaction);
        return true;
    }
    return false;
}

function register() {
    // Не нужна фоновая регистрация обработчиков событий — вся маршрутизация
    // идёт через handleButton/handleSelectMenu/handleModalSubmit,
    // вызываемые из index.js на каждый interactionCreate.
}

module.exports = { register, handleButton, handleSelectMenu, handleModalSubmit };
