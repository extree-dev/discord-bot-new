// Доменный слой тикетов: одна форма — жалоба на игрока (по прямому
// референсу администратора). Кнопка → модалка с двумя текстовыми полями
// (тег/ID, описание) → бот заводит приватный тред "ticket-<N>" в
// submissionsChannel и добавляет туда автора — дальше переписка идёт
// прямо в треде. Из старого жизненного цикла оставлены только claim
// ("Взять в работу") и close — нужны, когда несколько модераторов
// разбирают общую очередь жалоб; эскалация/приоритет/рейтинги/HTML-
// транскрипты/аппрувал для стажёров по-прежнему не возвращались. Общие
// вопросы, апелляции, баги убраны целиком — см. CHANGELOG. Роутинг по
// customId — в tickets/handlers.js.
const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { load, update } = require('./config');
const { COLORS, formatBody } = require('../utils/embeds');
const { notifyPunishment } = require('../utils/punishmentNotice');
const moderation = require('../moderation');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');

const OPEN_BUTTON_ID = 'ticket_open';
// Без embedded-ID в customId, в отличие от ticket_close:<authorId>/
// ticket_punish:<targetId> — обработчик всегда читает нужный тред прямо
// из interaction.channelId (кнопка живёт только на сообщении внутри
// самого треда), поэтому дополнительных данных в customId не нужно.
const CLAIM_BUTTON_ID = 'ticket_claim';

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
        .setLabel('Открыть тикет')
        .setStyle(ButtonStyle.Secondary);
    return toMessage(container, new ActionRowBuilder().addComponents(button));
}

// Первое сообщение в новом треде — "Взять в работу" (claim, см.
// claimTicket) всегда первой, дальше "Закрыть" (снимает доступ автора и
// архивирует тред, см. closeReport) и, если targetId удалось вытащить
// из введённого текста (см. extractTargetId), "Наказать".
function buildThreadWelcomeMessage(authorId, rawTarget, targetId, targetTag, description, reportHistoryCount) {
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

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(CLAIM_BUTTON_ID).setLabel('Взять в работу').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_close:${authorId}`).setLabel('Закрыть').setStyle(ButtonStyle.Secondary)
    );
    if (targetId) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_punish:${targetId}`)
                .setLabel('Наказать')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    return [container, row];
}

// Панель управления (отдельный staff-only канал, см. scripts/setup-
// ticket-management.js) — по прямому запросу администратора: просто
// сообщение с парой кнопок, без слэш-команд.
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
        .map(t => ({ name: t.name, url: t.url, claimedByTag: config.ticketsById?.[t.id]?.claimedByTag ?? null }));
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
    // Доступ автора к треду даёт само членство — у ThreadChannel в
    // discord.js нет API permissionOverwrites (треды не поддерживают
    // персональные оверрайты), а submissionsChannel закрыт от @everyone.
    // Повторная попытка с паузой (не сразу — если причина в задержке
    // применения состояния приватного треда на стороне Discord сразу
    // после создания, мгновенный повтор её не переживёт); если не
    // помогло — явное предупреждение прямо в треде с текстом реальной
    // ошибки Discord (а не просто "не получилось"), чтобы staff (видит
    // все треды через ManageThreads) сразу добавил автора вручную и
    // чтобы при повторении был виден настоящий код/текст ошибки, а не
    // только запись в консоли контейнера, которая никому не видна.
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
    const bodyComponents = buildThreadWelcomeMessage(
        interaction.user.id,
        rawTarget,
        targetId,
        targetTag,
        description,
        reportHistoryCount
    );
    await thread
        .send(toMessage(...bodyComponents))
        .catch(err => console.error('tickets: не удалось отправить сообщение в тред:', err));

    if (!authorAdded) {
        const detail = lastError?.message ? ` (${lastError.message})` : '';
        await thread
            .send(
                `⚠️ Не удалось автоматически добавить автора в тред${detail} — добавь вручную через список участников треда.`
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

// "Закрыть" — снимает доступ автора (только членство в треде, никаких
// персональных channel-оверрайтов не заводили — см. CHANGELOG про
// причину) и архивирует+блокирует сам тред как готовую запись, не
// удаляя её: история жалобы остаётся видна стафу в списке архивных
// тредов канала, просто больше не активна и не пишется в неё.
async function closeReport(thread, authorId) {
    await thread.members
        .remove(authorId)
        .catch(err => console.error('tickets: не удалось убрать автора из треда:', err));
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
    CLAIM_BUTTON_ID,
    REPORT_HISTORY_WINDOW_MS,
    isStaff,
    countRecentReportsOn,
    formatDuration,
    formatReportedUser,
    extractTargetId,
    buildPanelMessage,
    buildThreadWelcomeMessage,
    buildManagementPanelMessage,
    formatActiveTicketsList,
    formatTicketStats,
    listActiveTickets,
    getTicketStats,
    submitReport,
    punishReportedUser,
    closeReport,
    claimTicket,
};
