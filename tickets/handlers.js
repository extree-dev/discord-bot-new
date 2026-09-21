// Роутинг Discord-взаимодействий тикетов: сопоставляет customId с
// обработчиком и делегирует всю доменную работу в tickets/model.js —
// здесь только разбор interaction'а и построение ответных сообщений.
const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
const { load } = require('./config');
const { errorEmbed, successEmbed, infoEmbed } = require('../utils/embeds');
const model = require('./model');

const CREATE_MODAL_ID = 'ticket_modal_create';
const TARGET_INPUT_ID = 'ticket_target_input';
const DESCRIPTION_INPUT_ID = 'ticket_description_input';
const PUNISH_BUTTON_PREFIX = 'ticket_punish:';
const PUNISH_SELECT_PREFIX = 'ticket_punish_select:';
const MGMT_LIST_BUTTON_ID = 'ticket_mgmt_list';
const MGMT_STATS_BUTTON_ID = 'ticket_mgmt_stats';

// Два текстовых поля, как на референс-сервере — тег/ID нарушителя
// вводится текстом (не UserSelectMenu), сразу после кнопки, без
// промежуточных шагов.
function buildCreateModal() {
    const modal = new ModalBuilder().setCustomId(CREATE_MODAL_ID).setTitle('Жалоба на игрока');
    const targetInput = new TextInputBuilder()
        .setCustomId(TARGET_INPUT_ID)
        .setLabel('Тег или ID игрока')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Extree#8223 или 340773390518452227')
        .setMaxLength(100)
        .setRequired(true);
    const descriptionInput = new TextInputBuilder()
        .setCustomId(DESCRIPTION_INPUT_ID)
        .setLabel('Опишите ситуацию')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Приложи ссылку на сообщение или скрин-доказательство.')
        .setMaxLength(1000)
        .setRequired(true);
    modal.addComponents(
        new ActionRowBuilder().addComponents(targetInput),
        new ActionRowBuilder().addComponents(descriptionInput)
    );
    return modal;
}

async function handleOpenButton(interaction) {
    await interaction.showModal(buildCreateModal());
}

async function handleCreateModal(interaction) {
    // deferReply сразу, до любой асинхронной работы (фетч нарушителя по
    // ID, создание треда, отправка сообщения) — без него на медленной
    // сети interaction протухает за 3 секунды, хотя тикет всё равно
    // успешно создаётся в фоне.
    await interaction.deferReply({ ephemeral: true });

    try {
        const rawTarget = interaction.fields.getTextInputValue(TARGET_INPUT_ID).trim();
        const description = interaction.fields.getTextInputValue(DESCRIPTION_INPUT_ID).trim();
        const result = await model.submitReport(interaction, rawTarget, description);
        if (result.error) {
            await interaction.editReply({ embeds: [errorEmbed(result.error)] });
            return;
        }
        await interaction.editReply({
            embeds: [successEmbed(`Тикет создан: ${result.thread}`, 'Готово')],
        });
    } catch (err) {
        console.error('tickets: не удалось обработать отправку жалобы:', err);
        await interaction
            .editReply({ embeds: [errorEmbed('Не получилось открыть тикет — попробуй ещё раз чуть позже.')] })
            .catch(() => {});
    }
}

// "Наказать" на сообщении в треде жалобы — targetId зашит в customId
// самой кнопки (нет отдельной записи "тикета", откуда его можно было бы
// прочитать).
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

// Кнопки панели управления (отдельный staff-only канал, см.
// scripts/setup-ticket-management.js). "Активные тикеты" — список плюс
// select-меню; выбор в нём (handleManagementSelect) открывает карточку с
// действиями. Ни claim, ни close, ни punish больше не живут в самом
// треде жалобы — по прямому требованию администратора автор тикета не
// должен видеть ничего интерактивного.
async function handleManagementListButton(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может это смотреть.')],
            ephemeral: true,
        });
        return;
    }
    await interaction.deferReply({ ephemeral: true });
    const threads = await model.listActiveTickets(interaction.guild, config);
    await interaction.editReply({
        embeds: [successEmbed(model.formatActiveTicketsList(threads), 'Активные тикеты')],
        components: threads.length ? [model.buildTicketSelectRow(threads)] : [],
    });
}

async function handleManagementStatsButton(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может это смотреть.')],
            ephemeral: true,
        });
        return;
    }
    await interaction.deferReply({ ephemeral: true });
    const stats = await model.getTicketStats(interaction.guild, config);
    await interaction.editReply({ embeds: [successEmbed(model.formatTicketStats(stats), 'Статистика тикетов')] });
}

// Выбор тикета в select-меню из "Активные тикеты" — показывает карточку
// с действиями (Взять в работу/Закрыть/Наказать) вместо списка, на том
// же ephemeral-сообщении.
async function handleManagementSelect(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.update({ content: null, embeds: [errorEmbed('Нет доступа.')], components: [] });
        return;
    }
    const threadId = interaction.values[0];
    const record = config.ticketsById[threadId];
    if (!record) {
        await interaction.update({
            content: null,
            embeds: [errorEmbed('Тикет уже закрыт или не найден.')],
            components: [],
        });
        return;
    }
    await interaction.update({
        content: null,
        embeds: [infoEmbed(model.formatTicketDetail(record), `ticket-${record.number}`)],
        components: [model.buildTicketActionRow(threadId, record)],
    });
}

// "Взять в работу" из карточки тикета в канале управления — threadId
// зашит в customId (кнопка живёт вне самого треда, контекста
// interaction.channelId тут недостаточно). Подтверждение публикуется
// прямо в тред жалобы, чтобы автор и остальной staff видели, кто взял.
async function handleMgmtClaimButton(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может брать тикеты в работу.')],
            ephemeral: true,
        });
        return;
    }
    const threadId = interaction.customId.slice(model.MGMT_CLAIM_PREFIX.length);
    const record = await model.claimTicket(threadId, interaction.user.id, interaction.user.tag);
    if (!record) {
        await interaction.update({ content: null, embeds: [errorEmbed('Тикет уже закрыт.')], components: [] });
        return;
    }
    const thread =
        interaction.guild.channels.cache.get(threadId) ??
        (await interaction.guild.channels.fetch(threadId).catch(() => null));
    await thread?.send(`🧑‍💼 **Взял в работу:** ${interaction.user.tag}`).catch(() => {});
    await interaction.update({
        content: null,
        embeds: [infoEmbed(model.formatTicketDetail(record), `ticket-${record.number}`)],
        components: [model.buildTicketActionRow(threadId, record)],
    });
}

// "Закрыть" из карточки тикета в канале управления — authorId берём из
// сохранённой записи (customId несёт только threadId), model.closeReport
// сама удаляет запись из ticketsById.
async function handleMgmtCloseButton(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может закрывать тикеты.')],
            ephemeral: true,
        });
        return;
    }
    const threadId = interaction.customId.slice(model.MGMT_CLOSE_PREFIX.length);
    const record = config.ticketsById[threadId];
    if (!record) {
        await interaction.update({ content: null, embeds: [errorEmbed('Тикет уже закрыт.')], components: [] });
        return;
    }
    const thread =
        interaction.guild.channels.cache.get(threadId) ??
        (await interaction.guild.channels.fetch(threadId).catch(() => null));
    if (thread) await model.closeReport(thread, record.authorId);
    await interaction.update({ content: null, embeds: [successEmbed('Тикет закрыт.', 'Готово')], components: [] });
}

async function handleButton(interaction) {
    if (interaction.customId === model.OPEN_BUTTON_ID) {
        await handleOpenButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(PUNISH_BUTTON_PREFIX)) {
        await handlePunishButton(interaction);
        return true;
    }
    if (interaction.customId === MGMT_LIST_BUTTON_ID) {
        await handleManagementListButton(interaction);
        return true;
    }
    if (interaction.customId === MGMT_STATS_BUTTON_ID) {
        await handleManagementStatsButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(model.MGMT_CLAIM_PREFIX)) {
        await handleMgmtClaimButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(model.MGMT_CLOSE_PREFIX)) {
        await handleMgmtCloseButton(interaction);
        return true;
    }
    return false;
}

async function handleSelectMenu(interaction) {
    if (interaction.customId.startsWith(PUNISH_SELECT_PREFIX)) {
        await handlePunishSelect(interaction);
        return true;
    }
    if (interaction.customId === model.MGMT_SELECT_ID) {
        await handleManagementSelect(interaction);
        return true;
    }
    return false;
}

async function handleModalSubmit(interaction) {
    if (interaction.customId === CREATE_MODAL_ID) {
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
