// Роутинг Discord-взаимодействий тикетов: сопоставляет customId с
// обработчиком через карту (вместо цепочки if/else) и делегирует всю
// доменную работу в tickets/model.js — здесь только разбор
// interaction'а/события и построение ответных сообщений.
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
const { successContainer, infoContainer, errorContainer, toMessage } = require('../utils/components');
const model = require('./model');

const CREATE_MODAL_PREFIX = 'ticket_modal_create:';
const TARGET_SELECT_PREFIX = 'ticket_target_select:';
const DESCRIPTION_INPUT_ID = 'ticket_description_input';
const EXTRA_INPUT_ID = 'ticket_extra_input';
const NOTE_MODAL_ID = 'ticket_modal_note';
const NOTE_INPUT_ID = 'ticket_note_input';
const CLOSE_APPROVE_PREFIX = 'ticket_close_approve:';
const CLOSE_REJECT_PREFIX = 'ticket_close_reject:';
const CLOSE_REJECT_MODAL_PREFIX = 'ticket_close_reject_modal:';
const CLOSE_REJECT_REASON_INPUT_ID = 'ticket_close_reject_reason_input';

// Общий сборщик модалки создания тикета — вызывается сразу после выбора
// темы, либо (для тем с requiresTargetUser, например "Жалоба на игрока")
// уже после того, как автор выбрал конкретного игрока через UserSelectMenu
// — тогда targetId зашивается в customId и не даёт заново потерять выбор.
function buildCreateModal(reason, targetId = null) {
    const customId = targetId
        ? `${CREATE_MODAL_PREFIX}${reason.value}:${targetId}`
        : `${CREATE_MODAL_PREFIX}${reason.value}`;
    const modal = new ModalBuilder().setCustomId(customId).setTitle('Открыть тикет');

    const descriptionInput = new TextInputBuilder()
        .setCustomId(DESCRIPTION_INPUT_ID)
        .setLabel((reason.descriptionLabel ?? 'Опиши проблему подробно').slice(0, 45))
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true);
    if (reason.descriptionPlaceholder) descriptionInput.setPlaceholder(reason.descriptionPlaceholder.slice(0, 100));
    modal.addComponents(new ActionRowBuilder().addComponents(descriptionInput));

    if (reason.extraFieldLabel) {
        const extraInput = new TextInputBuilder()
            .setCustomId(EXTRA_INPUT_ID)
            .setLabel(reason.extraFieldLabel.slice(0, 45))
            .setStyle(TextInputStyle.Short)
            .setMaxLength(200)
            .setRequired(true);
        if (reason.extraFieldPlaceholder) extraInput.setPlaceholder(reason.extraFieldPlaceholder.slice(0, 100));
        modal.addComponents(new ActionRowBuilder().addComponents(extraInput));
    }
    return modal;
}

// Каждая тема на панели теперь открывается своей кнопкой (см.
// tickets/model.js buildPanelMessage) — без промежуточного выпадающего
// списка. reasonValue зашит в customId кнопки.
async function handleOpenReasonButton(interaction) {
    const reasonValue = interaction.customId.slice(model.OPEN_REASON_PREFIX.length);
    const reason = model.REASONS.find(r => r.value === reasonValue) ?? model.REASONS[model.REASONS.length - 1];

    const config = await load();
    const existing = model.findOpenTicketByOwner(config, interaction.user.id);
    if (existing) {
        await interaction.reply({
            embeds: [errorEmbed(`У тебя уже открыт тикет: <#${existing[0]}>`)],
            ephemeral: true,
        });
        return;
    }

    // Антиспам: не даём сразу открыть новый тикет после закрытия
    // предыдущего — проверяем до показа формы, чтобы не заставлять
    // человека заполнять модалку зря.
    const recentlyClosed = model.findRecentlyClosedTicketByOwner(
        config,
        interaction.user.id,
        Date.now(),
        config.ticketCooldownMs
    );
    if (recentlyClosed) {
        const waitMs = config.ticketCooldownMs - (Date.now() - recentlyClosed[1].closedAt);
        await interaction.reply({
            embeds: [errorEmbed(`Подожди ещё ${model.formatDuration(waitMs)} перед созданием нового тикета.`)],
            ephemeral: true,
        });
        return;
    }

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

// Общая для claim/adduser/close/voice/note проверка "это вообще канал
// тикета?" — оборачивает каждый обработчик, чтобы каждый оставался
// самостоятельным.
function withTicketEntry(handler) {
    return async interaction => {
        const config = await load();
        const entry = config.tickets[interaction.channelId];
        if (!entry) {
            await interaction.reply({ embeds: [errorEmbed('Это не канал тикета.')], ephemeral: true });
            return;
        }
        await handler(interaction, config, entry);
    };
}

const handleClaimButton = withTicketEntry(async (interaction, config, entry) => {
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может взять тикет в работу.')],
            ephemeral: true,
        });
        return;
    }
    if (entry.claimedBy && entry.claimedBy !== interaction.user.id) {
        await interaction.reply({
            embeds: [errorEmbed(`Тикет уже взят в работу <@${entry.claimedBy}>.`)],
            ephemeral: true,
        });
        return;
    }
    if (entry.claimedBy === interaction.user.id) {
        await interaction.reply({ embeds: [errorEmbed('Ты уже ведёшь этот тикет.')], ephemeral: true });
        return;
    }

    const claim = await model.claimTicket(interaction);

    if (claim.status === 'gone') {
        await interaction.reply({ embeds: [errorEmbed('Это не канал тикета.')], ephemeral: true });
        return;
    }
    if (claim.status === 'already-claimed') {
        await interaction.reply({
            embeds: [
                errorEmbed(
                    claim.claimedBy === interaction.user.id
                        ? 'Ты уже ведёшь этот тикет.'
                        : `Тикет уже взят в работу <@${claim.claimedBy}>.`
                ),
            ],
            ephemeral: true,
        });
        return;
    }

    await interaction.reply(
        toMessage(successContainer(`<@${interaction.user.id}> взял тикет в работу.`, 'Тикет взят в работу'))
    );
    await model.updateTicketRootMessage(interaction.client, interaction.channelId, claim.entry);
});

const handleAddUserButton = withTicketEntry(async (interaction, config) => {
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может добавлять участников.')],
            ephemeral: true,
        });
        return;
    }
    const select = new UserSelectMenuBuilder()
        .setCustomId('ticket_adduser_select')
        .setPlaceholder('Кого добавить в тикет?')
        .setMinValues(1)
        .setMaxValues(1);
    await interaction.reply({
        content: 'Выбери участника, чтобы дать ему доступ к тикету:',
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
    });
});

const handleCloseButton = withTicketEntry(async (interaction, config, entry) => {
    if (!model.canCloseTicket(config, entry, interaction.member)) {
        const reason = entry.claimedBy
            ? `Тикет ведёт <@${entry.claimedBy}>. Закрыть может только он или автор тикета.`
            : 'Только автор тикета или поддержка может его закрыть.';
        await interaction.reply({ embeds: [errorEmbed(reason)], ephemeral: true });
        return;
    }

    // Стажёр (Beta-Moderator/Beta-Support) не закрывает тикет сразу —
    // запрос уходит на подтверждение старшему составу (см.
    // model.requestTicketClosure). Автора тикета это не касается, даже
    // если он сам на испытательном сроке — гейт только на staff-закрытие,
    // не на закрытие автором своего же тикета.
    const isOwnerClosing = interaction.user.id === entry.ownerId;
    if (!isOwnerClosing && model.isTrialStaff(config, interaction.member)) {
        await interaction.deferReply({ ephemeral: true });
        const result = await model.requestTicketClosure(
            interaction.guild,
            interaction.channel,
            entry,
            interaction.user.id
        );
        await interaction.editReply(
            result.reviewChannel
                ? 'Запрос на закрытие отправлен старшему составу на подтверждение.'
                : 'Запрос сохранён, но канал подтверждения не настроен — сообщите администратору.'
        );
        return;
    }

    await interaction.deferUpdate();
    const threadId = interaction.channelId;
    await model.closeTicket(interaction.guild, interaction.channel, entry, interaction.user.id);
    await model.sendRatingRequest(interaction.client, entry, threadId).catch(() => {});
});

// Кнопки живут в канале подтверждения, а не в треде тикета — customId
// несёт ID треда, поэтому withTicketEntry (который берёт тикет из
// interaction.channelId) тут не подходит, ищем запись сами.
const handleCloseApproveButton = async interaction => {
    const ticketChannelId = interaction.customId.slice(CLOSE_APPROVE_PREFIX.length);
    const config = await load();
    if (!model.isSeniorStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Подтверждать закрытие может только старший состав.')],
            ephemeral: true,
        });
        return;
    }
    const entry = config.tickets[ticketChannelId];
    if (!entry || entry.status === model.STATUS.RESOLVED) {
        await interaction.update({
            content: null,
            embeds: [errorEmbed('Тикет не найден или уже закрыт.')],
            components: [],
        });
        return;
    }
    const ticketChannel =
        interaction.guild.channels.cache.get(ticketChannelId) ??
        (await interaction.guild.channels.fetch(ticketChannelId).catch(() => null));
    if (!ticketChannel) {
        await interaction.update({ content: null, embeds: [errorEmbed('Тред тикета не найден.')], components: [] });
        return;
    }

    await interaction.deferUpdate();
    const closedBy = entry.closeRequestedBy ?? interaction.user.id;
    await model.closeTicket(interaction.guild, ticketChannel, entry, closedBy, interaction.user.id);
    await model.sendRatingRequest(interaction.client, entry, ticketChannelId).catch(() => {});
    await interaction.editReply(
        toMessage(
            successContainer(`Закрытие тикета #${entry.number} подтверждено ${interaction.user}.`, 'Подтверждено')
        )
    );
};

const handleCloseRejectButton = async interaction => {
    const ticketChannelId = interaction.customId.slice(CLOSE_REJECT_PREFIX.length);
    const config = await load();
    if (!model.isSeniorStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Отклонять закрытие может только старший состав.')],
            ephemeral: true,
        });
        return;
    }
    if (!config.tickets[ticketChannelId]) {
        await interaction.reply({ embeds: [errorEmbed('Тикет не найден.')], ephemeral: true });
        return;
    }
    const modal = new ModalBuilder()
        .setCustomId(`${CLOSE_REJECT_MODAL_PREFIX}${ticketChannelId}`)
        .setTitle('Отклонить закрытие');
    const input = new TextInputBuilder()
        .setCustomId(CLOSE_REJECT_REASON_INPUT_ID)
        .setLabel('Почему не стоит закрывать?')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
};

const handleCloseRejectModal = async interaction => {
    const ticketChannelId = interaction.customId.slice(CLOSE_REJECT_MODAL_PREFIX.length);
    const config = await load();
    const entry = config.tickets[ticketChannelId];
    if (!entry) {
        await interaction.reply({ embeds: [errorEmbed('Тикет не найден.')], ephemeral: true });
        return;
    }
    const reason = interaction.fields.getTextInputValue(CLOSE_REJECT_REASON_INPUT_ID).trim();
    const ticketChannel =
        interaction.guild.channels.cache.get(ticketChannelId) ??
        (await interaction.guild.channels.fetch(ticketChannelId).catch(() => null));
    if (ticketChannel) {
        await model.rejectTicketClosure(interaction.guild, ticketChannel, entry, interaction.user.id, reason);
    }

    if (entry.closeReviewMessageId && interaction.channel) {
        const reviewMsg = await interaction.channel.messages.fetch(entry.closeReviewMessageId).catch(() => null);
        await reviewMsg
            ?.edit(
                toMessage(
                    errorContainer(
                        `Запрос на закрытие тикета #${entry.number} отклонён ${interaction.user}: ${reason}`,
                        'Отклонено'
                    )
                )
            )
            .catch(() => {});
    }

    await interaction.reply({
        embeds: [successEmbed('Запрос на закрытие отклонён, автор тикета уведомлён в треде.', 'Готово')],
        ephemeral: true,
    });
};

const handleVoiceButton = withTicketEntry(async (interaction, config, entry) => {
    // Только staff создаёт голосовое обсуждение — у автора тикета нет
    // причин заводить голосовой канал самостоятельно (например, чтобы
    // куда-то позвать посторонних без контроля поддержки); доступ в уже
    // созданную комнату у него при этом остаётся (см. overwrites в
    // createDiscussionVoiceChannel).
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка может открыть голосовое обсуждение.')],
            ephemeral: true,
        });
        return;
    }
    await interaction.deferReply({ ephemeral: true });
    const { channel, created } = await model.getOrCreateDiscussionVoiceChannel(interaction, entry);
    await interaction.editReply({
        embeds: [
            successEmbed(
                `Голосовая комната для обсуждения: ${channel}`,
                created ? 'Комната создана' : 'Комната для обсуждения'
            ),
        ],
    });
});

const handleNoteButton = withTicketEntry(async (interaction, config) => {
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Заметки может оставлять только поддержка или модератор.')],
            ephemeral: true,
        });
        return;
    }
    const modal = new ModalBuilder().setCustomId(NOTE_MODAL_ID).setTitle('Внутренняя заметка');
    const input = new TextInputBuilder()
        .setCustomId(NOTE_INPUT_ID)
        .setLabel('Текст заметки (видно только staff)')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
});

const PUNISH_SELECT_ID = 'ticket_punish_select';

const handlePunishButton = withTicketEntry(async (interaction, config, entry) => {
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Только поддержка или модератор может применять наказания.')],
            ephemeral: true,
        });
        return;
    }
    if (!entry.reportedUserId) {
        await interaction.reply({ embeds: [errorEmbed('В этом тикете не указан нарушитель.')], ephemeral: true });
        return;
    }
    const select = new StringSelectMenuBuilder()
        .setCustomId(PUNISH_SELECT_ID)
        .setPlaceholder('Выбери наказание')
        .addOptions(
            { label: 'Мут на 10 минут', value: 'mute:600' },
            { label: 'Мут на 1 час', value: 'mute:3600' },
            { label: 'Мут на 1 день', value: 'mute:86400' },
            { label: 'Мут на 7 дней', value: 'mute:604800' },
            { label: 'Забанить', value: 'ban' }
        );
    await interaction.reply({
        content: `Выбери наказание для <@${entry.reportedUserId}>:`,
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
    });
});

const handlePunishSelect = withTicketEntry(async (interaction, config, entry) => {
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({ embeds: [errorEmbed('Нет доступа к управлению этим тикетом.')], ephemeral: true });
        return;
    }
    const action = interaction.values[0];
    const result = await model.punishReportedUser(interaction, entry, action);
    if (result.error) {
        await interaction.update({ content: null, embeds: [errorEmbed(result.error)], components: [] });
        return;
    }
    await interaction.update({
        content: null,
        embeds: [successEmbed(`<@${entry.reportedUserId}> — ${result.label}.`, 'Наказание применено')],
        components: [],
    });
    await interaction.channel
        .send(
            toMessage(
                infoContainer(
                    `<@${entry.reportedUserId}> — ${result.label} модератором ${interaction.user}.`,
                    'Наказание применено'
                )
            )
        )
        .catch(() => {});
});

const BUTTON_HANDLERS = {
    ticket_claim: handleClaimButton,
    ticket_adduser: handleAddUserButton,
    ticket_close: handleCloseButton,
    ticket_voice: handleVoiceButton,
    ticket_note: handleNoteButton,
    ticket_punish: handlePunishButton,
};

async function handleRatingButton(interaction) {
    const [, threadId, valueStr] = interaction.customId.split(':');
    const entry = await model.recordRating(threadId, Number(valueStr));
    if (!entry) {
        await interaction.update(toMessage(errorContainer('Не удалось сохранить оценку — тикет не найден в базе.')));
        return;
    }
    await interaction.update(toMessage(successContainer('Спасибо за оценку!', 'Оценка сохранена')));
}

async function handleButton(interaction) {
    if (interaction.customId.startsWith('ticket_rate:')) {
        await handleRatingButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(model.OPEN_REASON_PREFIX)) {
        await handleOpenReasonButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(CLOSE_APPROVE_PREFIX)) {
        await handleCloseApproveButton(interaction);
        return true;
    }
    if (interaction.customId.startsWith(CLOSE_REJECT_PREFIX)) {
        await handleCloseRejectButton(interaction);
        return true;
    }
    const handler = BUTTON_HANDLERS[interaction.customId];
    if (!handler) return false;
    await handler(interaction);
    return true;
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

async function handleAddUserSelect(interaction) {
    const config = await load();
    const entry = config.tickets[interaction.channelId];
    if (!entry || !model.isStaff(config, interaction.member)) {
        await interaction.reply({ embeds: [errorEmbed('Нет доступа к управлению этим тикетом.')], ephemeral: true });
        return;
    }
    const targetId = interaction.values[0];
    const user = await model.addTicketMember(interaction, targetId);
    await interaction.reply({
        embeds: [successEmbed(`${user ?? 'Участник'} добавлен в тикет.`, 'Участник добавлен')],
        ephemeral: true,
    });
}

const SELECT_MENU_HANDLERS = {
    ticket_adduser_select: handleAddUserSelect,
    [PUNISH_SELECT_ID]: handlePunishSelect,
};

async function handleSelectMenu(interaction) {
    if (interaction.customId.startsWith(TARGET_SELECT_PREFIX)) {
        await handleTargetUserSelect(interaction);
        return true;
    }
    const handler = SELECT_MENU_HANDLERS[interaction.customId];
    if (!handler) return false;
    await handler(interaction);
    return true;
}

async function handleCreateModal(interaction) {
    const [reasonValue, targetId] = interaction.customId.slice(CREATE_MODAL_PREFIX.length).split(':');
    const reason = model.REASONS.find(r => r.value === reasonValue) ?? model.REASONS[model.REASONS.length - 1];
    const description = interaction.fields.getTextInputValue(DESCRIPTION_INPUT_ID).trim();
    const hasExtra = interaction.fields.fields.has(EXTRA_INPUT_ID);
    const extra = hasExtra ? interaction.fields.getTextInputValue(EXTRA_INPUT_ID).trim() : null;

    const fullDescription = extra ? `${description}\n\n**${reason.extraFieldLabel}:** ${extra}` : description;

    const result = await model.createTicket(interaction, reason, fullDescription, { reportedUserId: targetId ?? null });
    if (result.error) {
        await interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
        return;
    }
    await interaction.reply({
        embeds: [successEmbed(`Тикет создан: ${result.thread}`, 'Тикет создан')],
        ephemeral: true,
    });
}

const handleNoteModal = withTicketEntry(async (interaction, config, entry) => {
    if (!model.isStaff(config, interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Заметки может оставлять только поддержка или модератор.')],
            ephemeral: true,
        });
        return;
    }
    const text = interaction.fields.getTextInputValue(NOTE_INPUT_ID).trim();
    const notesThread = await model.getOrCreateNotesThread(interaction, entry);
    await notesThread.members.add(interaction.user.id).catch(() => {});
    await notesThread.send(toMessage(infoContainer(text, `Заметка от ${interaction.user.tag}`)));
    await interaction.reply({
        embeds: [successEmbed(`Заметка добавлена: ${notesThread}`, 'Сохранено')],
        ephemeral: true,
    });
});

async function handleModalSubmit(interaction) {
    if (interaction.customId.startsWith(CREATE_MODAL_PREFIX)) {
        await handleCreateModal(interaction);
        return true;
    }
    if (interaction.customId === NOTE_MODAL_ID) {
        await handleNoteModal(interaction);
        return true;
    }
    if (interaction.customId.startsWith(CLOSE_REJECT_MODAL_PREFIX)) {
        await handleCloseRejectModal(interaction);
        return true;
    }
    return false;
}

// Тред тикета — тоже обычный текстовый канал для событий Discord:
// каждое сообщение в нём двигает lastActivityAt и переключает статус
// open/waiting_on_user в зависимости от того, кто написал (см.
// model.recordActivity). Не трогаем DM (interaction.guild отсутствует
// у сообщений без гильдии) и сообщения самого бота.
async function handleMessageCreate(msg) {
    if (!msg.guild || msg.author.bot) return;
    const config = await load();
    const entry = config.tickets[msg.channelId];
    if (!entry) return;

    const authorIsOwner = msg.author.id === entry.ownerId;
    const updatedEntry = await model.recordActivity(msg.channelId, authorIsOwner);
    if (updatedEntry) await model.updateTicketRootMessage(msg.client, msg.channelId, updatedEntry);
}

function register(client) {
    client.on('messageCreate', msg => handleMessageCreate(msg).catch(err => console.error('tickets:', err)));
}

module.exports = { register, handleButton, handleModalSubmit, handleSelectMenu };
