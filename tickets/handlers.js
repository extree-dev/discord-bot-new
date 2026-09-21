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
const { errorEmbed, successEmbed } = require('../utils/embeds');
const model = require('./model');

const CREATE_MODAL_ID = 'ticket_modal_create';
const TARGET_INPUT_ID = 'ticket_target_input';
const DESCRIPTION_INPUT_ID = 'ticket_description_input';
const PUNISH_BUTTON_PREFIX = 'ticket_punish:';
const PUNISH_SELECT_PREFIX = 'ticket_punish_select:';
const CLOSE_BUTTON_PREFIX = 'ticket_close:';
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
        .setPlaceholder('Jerry Smith#6666 или 354261484395560961')
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

// "Взять в работу" на сообщении в треде жалобы — тред читается прямо из
// interaction.channelId (кнопка живёт только внутри своего треда, никаких
// данных в customId зашивать не нужно).
async function handleClaimButton(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может брать тикеты в работу.')],
            ephemeral: true,
        });
        return;
    }
    const record = await model.claimTicket(interaction.channelId, interaction.user.id, interaction.user.tag);
    if (!record) {
        await interaction.reply({ embeds: [errorEmbed('Тикет не найден (уже закрыт?).')], ephemeral: true });
        return;
    }
    await interaction.reply({ embeds: [successEmbed(`${interaction.user.tag} взял тикет в работу.`, 'Готово')] });
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

// "Закрыть" на сообщении в треде жалобы — authorId зашит в customId
// самой кнопки. Снимает доступ автора и архивирует тред как готовую
// запись (model.closeReport), без права переоткрыть — команды на этот
// случай нет, тема сужена до одной формы без жизненного цикла.
async function handleCloseButton(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может закрывать тикеты.')],
            ephemeral: true,
        });
        return;
    }
    const authorId = interaction.customId.slice(CLOSE_BUTTON_PREFIX.length);
    await interaction.deferReply({ ephemeral: true });
    await model.closeReport(interaction.channel, authorId);
    await interaction.editReply({ embeds: [successEmbed('Тикет закрыт, автор убран из треда.', 'Готово')] });
}

// Кнопки панели управления (отдельный staff-only канал, см.
// scripts/setup-ticket-management.js) — только чтение, никаких действий
// над конкретным тикетом.
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
    await interaction.editReply({ embeds: [successEmbed(model.formatActiveTicketsList(threads), 'Активные тикеты')] });
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

async function handleButton(interaction) {
    if (interaction.customId === model.OPEN_BUTTON_ID) {
        await handleOpenButton(interaction);
        return true;
    }
    if (interaction.customId === model.CLAIM_BUTTON_ID) {
        await handleClaimButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(PUNISH_BUTTON_PREFIX)) {
        await handlePunishButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(CLOSE_BUTTON_PREFIX)) {
        await handleCloseButton(interaction);
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
    return false;
}

async function handleSelectMenu(interaction) {
    if (interaction.customId.startsWith(PUNISH_SELECT_PREFIX)) {
        await handlePunishSelect(interaction);
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
