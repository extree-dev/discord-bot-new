// Доменный слой тикетов: одна форма — жалоба на игрока (по прямому
// референсу администратора). Кнопка → модалка с двумя текстовыми полями
// (тег/ID, описание) → бот заводит приватный тред "ticket-<N>" в
// submissionsChannel и добавляет туда автора — дальше переписка идёт
// прямо в треде. Сам тред — только информационное сообщение бота, без
// единой кнопки: по прямому требованию администратора весь claim/close/
// punish живёт исключительно в отдельном staff-only канале управления
// (см. buildTicketSelectRow/buildTicketActionRow ниже и scripts/setup-
// ticket-management.js) — автор тикета не должен видеть ничего, кроме
// подтверждения, что жалобу приняли в работу. Эскалация/приоритет/
// рейтинги/HTML-транскрипты/аппрувал для стажёров по-прежнему не
// возвращались. Общие вопросы, апелляции, баги убраны целиком — см.
// CHANGELOG. Роутинг по customId — в tickets/handlers.js.
const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js');
const { load, update } = require('./config');
const { COLORS, formatBody } = require('../utils/embeds');
const { notifyPunishment } = require('../utils/punishmentNotice');
const moderation = require('../moderation');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');

const OPEN_BUTTON_ID = 'ticket_open';
// Кнопки-действия над конкретным тикетом теперь живут в канале
// управления, а не в самом треде — customId обязан нести threadId явно
// (interaction.channelId там указывает на канал управления, а не на
// тред жалобы).
const MGMT_SELECT_ID = 'ticket_mgmt_select';
const MGMT_CLAIM_PREFIX = 'ticket_mgmt_claim:';
const MGMT_CLOSE_PREFIX = 'ticket_mgmt_close:';

// support/ModerateMembers/Administrator — обычный штат. Раньше здесь ещё
// проверялись специалист-роли по темам (бага, апелляции) — вместе с
// самими темами их убрали, осталась только жалоба на игрока.
function isStaff(config, member) {
    if (config.supportRoleId && member.roles.cache.has(config.supportRoleId)) return true;
    return (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ModerateMembers)
    );
}

// Сколько жалоб на того же игрока уже было за последние windowMs —
// снимок в момент отправки формы, чтобы модератор сразу видел повторного
// нарушителя прямо в треде, а не искал историю руками.
const REPORT_HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
function countRecentReportsOn(reports, targetUserId, now, windowMs) {
    return reports.filter(r => r.targetUserId === targetUserId && now - r.createdAt <= windowMs).length;
}

// "2 д 3 ч", "45 мин", "<1 мин" — используется в подписи к результату
// наказания. Чистая функция — без обращений к Discord.
function formatDuration(ms) {
    if (ms == null || ms < 0) return '—';
    if (ms < 60000) return '<1 мин';
    const totalMinutes = Math.round(ms / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days) parts.push(`${days} д`);
    if (hours) parts.push(`${hours} ч`);
    if (minutes && !days) parts.push(`${minutes} мин`);
    return parts.join(' ') || '<1 мин';
}

// Поле "тег/ID" — свободный текст (как на референс-сервере), не
// UserSelectMenu: участник мог ввести чистый ID (снежинку, 17-20 цифр)
// или тег вида "Имя#1234". Резолвим только чистый ID — искать участника
// по тегу без полного кэша участников гильдии ненадёжно, а лезть за
// каждым тегом в Discord API при каждой жалобе того не стоит. Если ID не
// вытащить — сообщение в треде просто показывает введённый текст как
// есть, без кнопки "Наказать" (честнее нерабочей кнопки, которая не
// найдёт, кого наказывать).
const SNOWFLAKE_RE = /^\d{17,20}$/;
function extractTargetId(rawTarget) {
    const trimmed = rawTarget.trim();
    return SNOWFLAKE_RE.test(trimmed) ? trimmed : null;
}

// НЕ <@id> — упоминание нарушителя запинговало бы его самого уведомлением
// о жалобе на себя. targetTag — тег на момент отправки формы (может быть
// null, если фетч не удался — тогда просто ID).
function formatReportedUser(targetId, targetTag) {
    return targetTag ? `${targetTag} (\`${targetId}\`)` : `\`${targetId}\``;
}

// Публичная панель — одна кнопка вместо сетки тем (раньше их было пять:
// общий вопрос/баг/жалоба/апелляция/другое — по решению администратора
// осталась только жалоба на игрока, сетка кнопок для одной темы не нужна).
function buildPanelMessage() {
    const container = baseContainer(COLORS.primary).addTextDisplayComponents(
        textDisplay(
            formatBody(
                'Жалоба на игрока',
                'Нажми кнопку ниже, укажи тег/ID нарушителя и опиши ситуацию — откроется тикет с командой поддержки.'
            )
        )
    );
    const button = new ButtonBuilder()
        .setCustomId(OPEN_BUTTON_ID)
        .setLabel('Жалоба на игрока')
        .setStyle(ButtonStyle.Secondary);
    return toMessage(container, new ActionRowBuilder().addComponents(button));
}

// Первое (и единственное) сообщение в новом треде — чисто информационное,
// без единой кнопки: claim/close/punish управляются только из канала
// управления (см. buildTicketActionRow), чтобы автор жалобы не видел
// ничего, кроме факта, что тикет принят.
function buildThreadWelcomeMessage(rawTarget, targetId, targetTag, description, reportHistoryCount) {
    const container = baseContainer(COLORS.primary)
        .addTextDisplayComponents(
            textDisplay(formatBody('Тикет открыт', 'Ожидайте, скоро мы присоединимся к вашему тикету.'))
        )
        .addSeparatorComponents(separator());

    const infoLines = [
        `**Тег/ID:** ${targetId ? formatReportedUser(targetId, targetTag) : `\`${rawTarget}\``}`,
        `**Описание:** ${description}`,
    ];
    if (reportHistoryCount > 1) {
        infoLines.push(`**История:** ${reportHistoryCount} жалоб(ы) за 30 дней`);
    }
    container.addTextDisplayComponents(textDisplay(infoLines.join('\n')));

    return [container];
}

// Панель управления (отдельный staff-only канал, см. scripts/setup-
// ticket-management.js) — по прямому запросу администратора: просто
// сообщение с парой кнопок, без слэш-команд. «Активные тикеты» ведёт к
// select-меню (см. buildTicketSelectRow) — оттуда уже идут все действия
// над конкретным тикетом.
function buildManagementPanelMessage() {
    const container = baseContainer(COLORS.primary).addTextDisplayComponents(
        textDisplay(formatBody('Управление тикетами', 'Кнопки ниже — только для поддержки и модерации.'))
    );
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_mgmt_list').setLabel('Активные тикеты').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_mgmt_stats').setLabel('Статистика').setStyle(ButtonStyle.Secondary)
    );
    return toMessage(container, row);
}

// Select-меню под списком активных тикетов в канале управления — выбор
// открывает карточку с действиями (buildTicketActionRow) для конкретного
// тикета. Discord ограничивает select-меню 25 опциями — при большем
// числе активных тикетов показываем самые старые (первые в очереди).
function buildTicketSelectRow(tickets) {
    const options = tickets.slice(0, 25).map(t =>
        new StringSelectMenuOptionBuilder()
            .setLabel(t.name)
            .setDescription((t.claimedByTag ? `взял ${t.claimedByTag}` : 'не взят').slice(0, 100))
            .setValue(t.id)
    );
    const select = new StringSelectMenuBuilder()
        .setCustomId(MGMT_SELECT_ID)
        .setPlaceholder('Выбери тикет для действия')
        .addOptions(options);
    return new ActionRowBuilder().addComponents(select);
}

// Карточка конкретного тикета после выбора в select-меню — показывается
// ephemeral в канале управления.
function formatTicketDetail(record) {
    return [
        `**Тикет:** ticket-${record.number}`,
        `**Автор:** \`${record.authorId}\``,
        `**Тег/ID нарушителя:** ${record.targetId ? formatReportedUser(record.targetId, record.targetTag) : '—'}`,
        `**Взял в работу:** ${record.claimedByTag ?? 'никто'}`,
    ].join('\n');
}

// "Наказать" переиспользует существующий ticket_punish:<targetId> —
// сама кнопка не привязана к месту показа, ей всё равно, из какого
// канала пришло взаимодействие (см. handlePunishButton).
function buildTicketActionRow(threadId, record) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${MGMT_CLAIM_PREFIX}${threadId}`)
            .setLabel('Взять в работу')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`${MGMT_CLOSE_PREFIX}${threadId}`)
            .setLabel('Закрыть')
            .setStyle(ButtonStyle.Secondary)
    );
    if (record.targetId) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_punish:${record.targetId}`)
                .setLabel('Наказать')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    return row;
}

// Чистое форматирование — переиспользуется и тестируется отдельно от
// живого guild.channels.threads.fetchActive() ниже.
function formatActiveTicketsList(threads) {
    if (!threads.length) return 'Открытых тикетов нет.';
    return threads
        .map(t => `• ${t.name} — ${t.url} — ${t.claimedByTag ? `взял ${t.claimedByTag}` : 'не взят'}`)
        .join('\n');
}

function formatTicketStats({ activeCount, unclaimedCount, totalCount, reportsCount }) {
    return [
        `**Открыто сейчас:** ${activeCount}`,
        `**Не взято в работу:** ${unclaimedCount}`,
        `**Всего создано за всё время:** ${totalCount}`,
        `**Жалоб в истории:** ${reportsCount}`,
    ].join('\n');
}

// Активные (неархивированные) треды жалоб в submissionsChannel,
// отсортированные по времени создания — snowflake ID, тот же приём, что
// pickOldest в utils/idempotent.js. claimedByTag — из config.ticketsById
// (см. claimTicket), не из самого Discord-треда — там этого не хранится.
async function listActiveTickets(guild, config) {
    const channelId = config.submissionsChannelId;
    if (!channelId) return [];
    const channel = channelId
        ? (guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null)))
        : null;
    if (!channel) return [];
    const active = await channel.threads.fetchActive().catch(() => null);
    if (!active) return [];
    return [...active.threads.values()]
        .filter(t => t.name.startsWith('ticket-'))
        .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0))
        .map(t => ({
            id: t.id,
            name: t.name,
            url: t.url,
            claimedByTag: config.ticketsById?.[t.id]?.claimedByTag ?? null,
        }));
}

async function getTicketStats(guild, config) {
    const active = await listActiveTickets(guild, config);
    return {
        activeCount: active.length,
        unclaimedCount: active.filter(t => !t.claimedByTag).length,
        totalCount: config.counter ?? 0,
        reportsCount: config.reports?.length ?? 0,
    };
}

// "Взять в работу" — фиксирует, кто из стафа разбирает тикет, чтобы
// несколько модераторов не отвечали одному и тому же участнику вразнобой
// и чтобы "Активные тикеты" показывал, что ещё никто не подхватил.
// Повторное нажатие (в том числе другим модератором) просто переставляет
// claimedBy — отдельного "открепить" не делаем, тема не про полноценный
// жизненный цикл с правами на переназначение.
async function claimTicket(threadId, staffId, staffTag) {
    return update(c => {
        const record = c.ticketsById[threadId];
        if (!record) return null;
        record.claimedBy = staffId;
        record.claimedByTag = staffTag;
        return record;
    });
}

// Обрабатывает заполненную форму — резервирует номер тикета (лок
// update(), тот же приём, что раньше был у createTicket), резолвит
// targetId (если получится), считает и сохраняет историю жалоб на него
// (countRecentReportsOn/config.reports), заводит приватный тред
// "ticket-<N>" в submissionsChannel, добавляет автора участником и
// отправляет туда стартовое сообщение с пингом Support.
async function submitReport(interaction, rawTarget, description) {
    const guild = interaction.guild;
    const now = Date.now();
    const targetId = extractTargetId(rawTarget);
    let targetTag = null;
    if (targetId) {
        const member = await guild.members.fetch(targetId).catch(() => null);
        targetTag = member?.user.tag ?? null;
    }

    // Номер тикета и история жалоб — одной атомарной операцией (лок
    // update()), иначе два почти одновременных клика могли бы получить
    // один и тот же номер или прочитать историю до того, как друг друга
    // запишут.
    const { number, reportHistoryCount } = await update(c => {
        c.counter = (c.counter ?? 0) + 1;
        const count = targetId ? countRecentReportsOn(c.reports, targetId, now, REPORT_HISTORY_WINDOW_MS) : 0;
        if (targetId) c.reports.push({ targetUserId: targetId, createdAt: now });
        return { number: c.counter, reportHistoryCount: count };
    });

    const config = await load();
    const channelId = config.submissionsChannelId;
    const channel = channelId
        ? (guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null)))
        : null;
    if (!channel) {
        return { error: 'Система обращений не настроена (нет канала для тикетов). Обратись к администратору.' };
    }

    let thread;
    try {
        thread = await channel.threads.create({
            name: `ticket-${number}`.slice(0, 95),
            type: ChannelType.PrivateThread,
            // invitable: true — иначе добавлять участников в приватный
            // тред может только тот, у кого ManageThreads явным
            // оверрайтом именно на этом канале (см. scripts/setup-
            // tickets.js) — у самого бота такого оверрайта нет, только у
            // ролей стафа, поэтому thread.members.add() ниже молча падал
            // с "Missing Permissions", даже для бота-создателя треда.
            invitable: true,
            reason: `Жалоба #${number} от ${interaction.user.tag}`,
        });
    } catch (err) {
        console.error('tickets: не удалось создать тред жалобы:', err);
        return { error: 'Не получилось открыть тикет — попробуй ещё раз чуть позже.' };
    }
    // Членство в треде (thread.members.add) в теории должно само по себе
    // давать доступ к приватному треду независимо от прав на родительский
    // канал — так исторически было в этом же боте, так документирует
    // Discord. На практике на этом сервере автор раза за разом (ticket-88,
    // ticket-89) тред не видел, даже после ретрая с паузой — то есть
    // проблема не в разовой гонке, а в чём-то системном именно с этой
    // гильдией/конфигурацией. Не гадаем дальше: вдобавок к членству выдаём
    // автору личный ViewChannel-оверрайт на сам submissionsChannel — это
    // гарантированно достаточно независимо от того, как Discord на самом
    // деле обрабатывает членство в приватных тредах здесь. Другие приватные
    // треды в этом канале автору всё равно не видны — ViewChannel на
    // родителе открывает только сам канал и публичные треды в нём, не
    // чужие приватные. Оверрайт снимается в closeReport(), поэтому не
    // копится бесконечно (тот самый лимит ~100 оверрайтов на канал,
    // который раньше был причиной не заводить их без механизма закрытия —
    // теперь он есть).
    await channel.permissionOverwrites
        .edit(interaction.user.id, { ViewChannel: true })
        .catch(err => console.error('tickets: не удалось выдать автору личный доступ к каналу:', err));

    let authorAdded = false;
    let lastError = null;
    for (let attempt = 1; attempt <= 2 && !authorAdded; attempt++) {
        try {
            await thread.members.add(interaction.user.id);
            authorAdded = true;
        } catch (err) {
            lastError = err;
            console.error(`tickets: не удалось добавить автора в тред жалобы (попытка ${attempt}):`, err);
            if (attempt === 1) await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    // Без пинга роли — как на референс-сервере: ManageThreads на
    // submissionsChannel (см. scripts/setup-tickets.js) уже даёт роли
    // Support видеть каждый новый приватный тред без явного добавления
    // в участники и без отдельного уведомления через упоминание.
    const bodyComponents = buildThreadWelcomeMessage(rawTarget, targetId, targetTag, description, reportHistoryCount);
    await thread
        .send(toMessage(...bodyComponents))
        .catch(err => console.error('tickets: не удалось отправить сообщение в тред:', err));

    if (!authorAdded) {
        const detail = lastError?.message ? ` (${lastError.message})` : '';
        await thread
            .send(
                `⚠️ Не удалось автоматически добавить автора в тред${detail} — добавь вручную через список участников треда. Личный доступ к каналу уже выдан, но самого треда это может быть недостаточно.`
            )
            .catch(() => {});
    }

    // Для claim-статуса в "Активные тикеты" (см. listActiveTickets) —
    // запись живёт, пока тикет открыт, и удаляется в closeReport.
    await update(c => {
        c.ticketsById[thread.id] = {
            number,
            authorId: interaction.user.id,
            targetId,
            targetTag,
            claimedBy: null,
            claimedByTag: null,
            createdAt: now,
        };
    });

    return { ok: true, thread };
}

// "Наказать" на сообщении в треде жалобы — targetId зашит в customId
// самой кнопки (нет отдельной записи "тикета", откуда его можно было бы
// прочитать).
async function punishReportedUser(interaction, targetId, action, contextLabel) {
    const guild = interaction.guild;
    const auditReason = `Жалоба (${contextLabel}), модератор ${interaction.user.tag}`;
    const dmReason = `По итогам рассмотрения жалобы (${contextLabel}).`;

    if (action === 'ban') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return { error: 'У тебя нет права банить участников.' };
        }
        const member = await guild.members.fetch(targetId).catch(() => null);
        if (member && !member.bannable) {
            return { error: 'Не могу забанить этого участника (недостаточно прав или роль выше моей).' };
        }
        // Уведомление о наказании для банов не отправляется — см.
        // комментарий в utils/punishmentNotice.js (забаненный теряет
        // доступ ко всем каналам/тредам гильдии, прочитать всё равно не
        // сможет).
        await guild.members.ban(targetId, { reason: auditReason });
        return { label: 'забанен' };
    }

    const seconds = Number(action.split(':')[1]);
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) return { error: 'Участник не найден на сервере.' };
    const muteResult = await moderation.muteMember(guild, member, seconds * 1000, auditReason, interaction.user.id);
    if (muteResult.error) return { error: muteResult.error };
    await notifyPunishment(member.user, guild, {
        kind: 'timeout',
        reason: dmReason,
        durationLabel: formatDuration(seconds * 1000),
    });
    return { label: `замучен на ${formatDuration(seconds * 1000)}` };
}

// "Закрыть" — снимает доступ автора (членство в треде + личный
// ViewChannel-оверрайт на submissionsChannel, см. submitReport) и
// архивирует+блокирует сам тред как готовую запись, не удаляя её: история
// жалобы остаётся видна стафу в списке архивных тредов канала, просто
// больше не активна и не пишется в неё. Оверрайт удаляется целиком (не
// просто гасится в false), иначе он продолжал бы занимать место в лимите
// ~100 оверрайтов на канал даже для закрытых тикетов.
async function closeReport(thread, authorId) {
    await thread.members
        .remove(authorId)
        .catch(err => console.error('tickets: не удалось убрать автора из треда:', err));
    const parent = thread.parent ?? (await thread.guild.channels.fetch(thread.parentId).catch(() => null));
    if (parent) {
        await parent.permissionOverwrites
            .delete(authorId)
            .catch(err => console.error('tickets: не удалось снять личный доступ автора к каналу:', err));
    }
    await thread
        .setLocked(true, 'Тикет закрыт')
        .catch(err => console.error('tickets: не удалось заблокировать тред:', err));
    await thread
        .setArchived(true, 'Тикет закрыт')
        .catch(err => console.error('tickets: не удалось заархивировать тред:', err));
    // Закрытый тикет больше не входит в fetchActive() сам по себе — запись
    // в ticketsById нужна была только для claim-статуса живых тикетов,
    // дальше она бы просто копилась без дела (в отличие от reports, эта
    // карта не нужна для истории/статистики после закрытия).
    await update(c => {
        delete c.ticketsById[thread.id];
    });
}

module.exports = {
    OPEN_BUTTON_ID,
    MGMT_SELECT_ID,
    MGMT_CLAIM_PREFIX,
    MGMT_CLOSE_PREFIX,
    REPORT_HISTORY_WINDOW_MS,
    isStaff,
    countRecentReportsOn,
    formatDuration,
    formatReportedUser,
    extractTargetId,
    buildPanelMessage,
    buildThreadWelcomeMessage,
    buildManagementPanelMessage,
    buildTicketSelectRow,
    formatTicketDetail,
    buildTicketActionRow,
    formatActiveTicketsList,
    formatTicketStats,
    listActiveTickets,
    getTicketStats,
    submitReport,
    punishReportedUser,
    closeReport,
    claimTicket,
};
