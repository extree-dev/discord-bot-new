// Роутинг Discord-взаимодействий тикетов: сопоставляет customId с
// обработчиком и делегирует всю доменную работу в tickets/model.js —
// здесь только разбор interaction'а и построение ответных сообщений.
const {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    MessageFlags,
} = require('discord.js');
const { load } = require('./config');
const { errorEmbed, successEmbed, infoEmbed } = require('../utils/embeds');
const model = require('./model');

const CREATE_MODAL_ID = 'ticket_modal_create';
const CREATE_MODAL_MESSAGE_ID = 'ticket_modal_create:message';
const TARGET_INPUT_ID = 'ticket_target_input';
const DESCRIPTION_INPUT_ID = 'ticket_description_input';
const APPEAL_MODAL_ID = 'ticket_modal_appeal';
const APPEAL_REASON_INPUT_ID = 'ticket_appeal_reason_input';
const PUNISH_BUTTON_PREFIX = 'ticket_punish:';
const PUNISH_SELECT_PREFIX = 'ticket_punish_select:';
const MGMT_LIST_BUTTON_ID = 'ticket_mgmt_list';
const MGMT_STATS_BUTTON_ID = 'ticket_mgmt_stats';

// Два текстовых поля, как на референс-сервере — тег/ID нарушителя
// вводится текстом (не UserSelectMenu), сразу после кнопки, без
// промежуточных шагов. prefill.kind — для контекстного меню "Пожаловаться
// на сообщение" (commands/contextMenu/reportMessage.js): та же форма, те
// же два поля, просто уже заполненные (автор сообщения + ссылка на него),
// и свой customId (CREATE_MODAL_MESSAGE_ID вместо CREATE_MODAL_ID) — чтобы
// handleModalSubmit знал, с каким типом жалобы работает, и прокинул его
// дальше в submitReport() для разного заголовка карточки в треде и в
// канале управления (см. tickets/model.js ticketKindTitle).
function buildCreateModal(prefill = {}) {
    const isMessageReport = prefill.kind === 'message';
    const modal = new ModalBuilder()
        .setCustomId(isMessageReport ? CREATE_MODAL_MESSAGE_ID : CREATE_MODAL_ID)
        .setTitle(isMessageReport ? 'Жалоба на сообщение' : 'Жалоба на игрока');
    const targetInput = new TextInputBuilder()
        .setCustomId(TARGET_INPUT_ID)
        .setLabel('Тег или ID игрока')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Extree#8223 или 340773390518452227')
        .setMaxLength(100)
        .setRequired(true);
    if (prefill.target) targetInput.setValue(prefill.target);
    const descriptionInput = new TextInputBuilder()
        .setCustomId(DESCRIPTION_INPUT_ID)
        .setLabel('Опишите ситуацию')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Приложи ссылку на сообщение или скрин-доказательство.')
        .setMaxLength(1000)
        .setRequired(true);
    if (prefill.description) descriptionInput.setValue(prefill.description);
    modal.addComponents(
        new ActionRowBuilder().addComponents(targetInput),
        new ActionRowBuilder().addComponents(descriptionInput)
    );
    return modal;
}

async function handleOpenButton(interaction) {
    await interaction.showModal(buildCreateModal());
}

async function handleCreateModal(interaction, kind) {
    // deferReply сразу, до любой асинхронной работы (фетч нарушителя по
    // ID, создание треда, отправка сообщения) — без него на медленной
    // сети interaction протухает за 3 секунды, хотя тикет всё равно
    // успешно создаётся в фоне.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const rawTarget = interaction.fields.getTextInputValue(TARGET_INPUT_ID).trim();
        const description = interaction.fields.getTextInputValue(DESCRIPTION_INPUT_ID).trim();
        const result = await model.submitReport(interaction, rawTarget, description, kind);
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

// Модалка апелляции — одно поле, показывается только когда до конца мута
// ещё далеко (см. model.getAppealStatus/handleAppealButton ниже); на
// коротком хвосте срока мут снимается сразу по клику, без набора причины.
function buildAppealModal() {
    const modal = new ModalBuilder().setCustomId(APPEAL_MODAL_ID).setTitle('Апелляция на мут');
    const reasonInput = new TextInputBuilder()
        .setCustomId(APPEAL_REASON_INPUT_ID)
        .setLabel('Почему мут нужно снять раньше срока')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Объясни модерации, почему наказание стоит пересмотреть.')
        .setMaxLength(1000)
        .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    return modal;
}

// Кнопка "Подать апелляцию" на той же панели, что "Жалоба на игрока" —
// не слэш-команда (см. model.APPEAL_BUTTON_ID), потому что роль Muted
// лишена UseApplicationCommands на каждом канале сервера и физически не
// смогла бы вызвать команду. Проверяем мут ДО показа модалки — бессмысленно
// просить причину у того, кому нечего апеллировать, или у кого мут и так
// снимется в ближайшие минуты.
async function handleAppealButton(interaction) {
    const status = await model.getAppealStatus(interaction.guild, interaction.user.id);
    if (!status.hasMute) {
        await interaction.reply({
            embeds: [
                infoEmbed(
                    'У тебя нет активного мута — апеллировать нечего. Апелляция на бан через бота недоступна: забаненный теряет доступ ко всем каналам и командам сервера, включая эту панель, — обратись к администрации напрямую.',
                    'Нет активного мута'
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    if (status.requiresReason) {
        await interaction.showModal(buildAppealModal());
        return;
    }
    await model.submitAppeal(interaction.guild, interaction.user, null);
    await interaction.reply({
        embeds: [successEmbed('Срок мута почти истёк — снят автоматически.', 'Мут снят')],
        flags: MessageFlags.Ephemeral,
    });
}

async function handleAppealModal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const reason = interaction.fields.getTextInputValue(APPEAL_REASON_INPUT_ID).trim();
        const result = await model.submitAppeal(interaction.guild, interaction.user, reason);
        if (result.error) {
            await interaction.editReply({
                embeds: [infoEmbed('У тебя нет активного мута — апеллировать нечего.', 'Нет активного мута')],
            });
            return;
        }
        if (result.autoApproved) {
            await interaction.editReply({
                embeds: [successEmbed('Срок мута почти истёк — снят автоматически.', 'Мут снят')],
            });
            return;
        }
        await interaction.editReply({
            embeds: [
                infoEmbed(
                    'Апелляция отправлена на рассмотрение модерации. Решат снять мут раньше срока — сделают это вручную.',
                    'Отправлено'
                ),
            ],
        });
    } catch (err) {
        console.error('tickets: не удалось обработать апелляцию:', err);
        await interaction
            .editReply({ embeds: [errorEmbed('Не получилось отправить апелляцию — попробуй ещё раз чуть позже.')] })
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
            flags: MessageFlags.Ephemeral,
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
        flags: MessageFlags.Ephemeral,
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
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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
    const isSenior = model.isSeniorStaff(config, interaction.member);
    await interaction.update({
        content: null,
        embeds: [infoEmbed(model.formatTicketDetail(record), `ticket-${record.number}`)],
        components: [model.buildTicketActionRow(threadId, record, isSenior)],
    });
}

// "Взять в работу" из карточки тикета в канале управления — threadId
// зашит в customId (кнопка живёт вне самого треда). Никакого сообщения в
// сам тред не шлём — по прямому требованию администратора тред жалобы
// остаётся чисто информационным, claim-статус виден только здесь же, в
// канале управления (карточка тикета и список "Активные тикеты"). Тикет
// закреплён за одним сотрудником (item 3) — claimTicket отклоняет попытку,
// если его уже взял кто-то другой.
async function handleMgmtClaimButton(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может брать тикеты в работу.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const threadId = interaction.customId.slice(model.MGMT_CLAIM_PREFIX.length);
    const result = await model.claimTicket(threadId, interaction.user.id, interaction.user.tag);
    if (!result.ok) {
        const message =
            result.reason === 'already_claimed'
                ? `Тикет уже взял в работу ${result.claimedByTag}.`
                : result.reason === 'staff_busy'
                  ? `У тебя уже в работе ticket-${result.busyTicketNumber} — сначала закрой его.`
                  : 'Тикет уже закрыт.';
        await interaction.update({ content: null, embeds: [errorEmbed(message)], components: [] });
        return;
    }
    const isSenior = model.isSeniorStaff(config, interaction.member);
    await interaction.update({
        content: null,
        embeds: [infoEmbed(model.formatTicketDetail(result.record), `ticket-${result.record.number}`)],
        components: [model.buildTicketActionRow(threadId, result.record, isSenior)],
    });
}

// "Закрыть"/"Запросить закрытие" из карточки тикета в канале управления —
// authorId берём из сохранённой записи (customId несёт только threadId).
// Старший состав (isSeniorStaff) закрывает тикет сразу, как раньше; стажёр
// (Beta-Support/Beta-Moderator) только помечает запрос — сам тред закроет
// уже handleMgmtApproveCloseButton после подтверждения старшим составом
// (item 2 — без подтверждения стажёр закрыть тикет не может).
async function handleMgmtCloseButton(interaction) {
    const config = await load();
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может закрывать тикеты.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const threadId = interaction.customId.slice(model.MGMT_CLOSE_PREFIX.length);
    const record = config.ticketsById[threadId];
    if (!record) {
        await interaction.update({ content: null, embeds: [errorEmbed('Тикет уже закрыт.')], components: [] });
        return;
    }
    const isSenior = model.isSeniorStaff(config, interaction.member);

    if (isSenior) {
        const thread =
            interaction.guild.channels.cache.get(threadId) ??
            (await interaction.guild.channels.fetch(threadId).catch(() => null));
        if (thread) await model.closeReport(thread, record.authorId);
        await interaction.update({
            content: null,
            embeds: [successEmbed('Тикет закрыт.', 'Готово')],
            components: [],
        });
        return;
    }

    if (record.pendingClose) {
        await interaction.update({
            content: null,
            embeds: [infoEmbed(model.formatTicketDetail(record), `ticket-${record.number}`)],
            components: [model.buildTicketActionRow(threadId, record, isSenior)],
        });
        return;
    }

    const result = await model.requestCloseApproval(threadId, interaction.user.id, interaction.user.tag);
    if (!result.ok) {
        await interaction.update({ content: null, embeds: [errorEmbed('Тикет уже закрыт.')], components: [] });
        return;
    }
    await interaction.update({
        content: null,
        embeds: [infoEmbed(model.formatTicketDetail(result.record), `ticket-${result.record.number}`)],
        components: [model.buildTicketActionRow(threadId, result.record, isSenior)],
    });
}

// "Подтвердить закрытие" — видна только старшему составу, когда есть
// pendingClose (см. buildTicketActionRow). Закрывает тикет тем же путём,
// что и прямое "Закрыть" от старшего состава.
async function handleMgmtApproveCloseButton(interaction) {
    const config = await load();
    if (!model.isSeniorStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Подтверждать закрытие может только старший состав.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const threadId = interaction.customId.slice(model.MGMT_APPROVE_CLOSE_PREFIX.length);
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

// "Отклонить закрытие" — снимает pendingClose, тикет остаётся открытым и
// закреплённым за тем же сотрудником, который его взял.
async function handleMgmtDenyCloseButton(interaction) {
    const config = await load();
    if (!model.isSeniorStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Отклонять закрытие может только старший состав.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const threadId = interaction.customId.slice(model.MGMT_DENY_CLOSE_PREFIX.length);
    const result = await model.rejectCloseRequest(threadId);
    if (!result.ok) {
        await interaction.update({ content: null, embeds: [errorEmbed('Тикет уже закрыт.')], components: [] });
        return;
    }
    const isSenior = true;
    await interaction.update({
        content: null,
        embeds: [infoEmbed(model.formatTicketDetail(result.record), `ticket-${result.record.number}`)],
        components: [model.buildTicketActionRow(threadId, result.record, isSenior)],
    });
}

async function handleButton(interaction) {
    if (interaction.customId === model.OPEN_BUTTON_ID) {
        await handleOpenButton(interaction);
        return true;
    }
    if (interaction.customId === model.APPEAL_BUTTON_ID) {
        await handleAppealButton(interaction);
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
    if (interaction.customId.startsWith(model.MGMT_APPROVE_CLOSE_PREFIX)) {
        await handleMgmtApproveCloseButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(model.MGMT_DENY_CLOSE_PREFIX)) {
        await handleMgmtDenyCloseButton(interaction);
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
        await handleCreateModal(interaction, 'player');
        return true;
    }
    if (interaction.customId === CREATE_MODAL_MESSAGE_ID) {
        await handleCreateModal(interaction, 'message');
        return true;
    }
    if (interaction.customId === APPEAL_MODAL_ID) {
        await handleAppealModal(interaction);
        return true;
    }
    return false;
}

// Отмечает активность в треде тикета для tickets/sweep.js (авто-закрытие
// неактивных) — любое человеческое сообщение в треде сбрасывает отсчёт
// простоя, неважно, кто написал: автор или staff. Пропускаем сообщения
// бота (message.author.bot) — иначе собственные уведомления sweep.js
// ("нет активности" / "закрыт автоматически") сами сбрасывали бы только
// что выставленное предупреждение, и тикет никогда не закрылся бы.
async function handleMessageCreate(message) {
    if (!message.guild || message.author.bot) return;
    if (!message.channel.isThread()) return;
    const config = await load();
    if (message.channel.parentId !== config.submissionsChannelId) return;
    if (!config.ticketsById[message.channel.id]) return;
    await model.touchTicketActivity(message.channel.id);
}

function register(client) {
    client.on('messageCreate', msg => {
        handleMessageCreate(msg).catch(err => console.error('tickets messageCreate:', err));
    });
}

module.exports = { register, handleButton, handleSelectMenu, handleModalSubmit, handleMessageCreate, buildCreateModal };
