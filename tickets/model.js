// Доменный слой тикетов: правила (кто staff), список тем обращения,
// построение панели/карточки, отправка формы и точечные модераторские
// действия по итогам жалобы/апелляции (наказать/снять наказание).
// Роутинг по customId — в tickets/handlers.js.
//
// Раньше здесь был полноценный жизненный цикл тикета (приватный тред,
// claim/отпустить/переназначить, эскалация, приоритет, рейтинги,
// HTML-транскрипты, испытательный срок для стажёров) — по решению
// администратора вся эта надстройка убрана: она не была нужна, вместо
// неё — простая форма, как на референс-сервере (кнопка → модалка →
// карточка падает в канал стафу, без дальнейшего движения). См.
// CHANGELOG за подробностями и историей.
const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { load, update } = require('./config');
const { COLORS, formatBody } = require('../utils/embeds');
const { notifyPunishment } = require('../utils/punishmentNotice');
const moderation = require('../moderation');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');

// customId-префикс кнопки конкретной темы на панели поддержки — общий с
// tickets/handlers.js, поэтому экспортируется, а не только используется
// локально в buildPanelMessage.
const OPEN_REASON_PREFIX = 'ticket_open_reason:';

// descriptionLabel/descriptionPlaceholder — чтобы модалка формы явно
// объясняла, что писать, а не показывала одну и ту же общую подпись для
// всех тем (жалоба на баг ждёт совсем не то, что общий вопрос).
// requiresTargetUser — вместо текстового поля с ником/ID нарушителя,
// который автор жалобы не всегда знает как достать, tickets/handlers.js
// сначала показывает UserSelectMenu и передаёт выбранный ID в модалку.
const REASONS = [
    {
        value: 'general',
        label: 'Общий вопрос',
        descriptionLabel: 'Опиши свой вопрос',
        descriptionPlaceholder: 'Например: как получить роль за уровень?',
    },
    {
        value: 'bug',
        label: 'Баг / техническая проблема',
        // Отдельная очередь, а не общая: своя кнопка живёт в своём канале
        // (config.bugPanelChannelId, см. scripts/setup-tickets.js), не
        // показывается на общей панели (buildPanelMessage её фильтрует),
        // карточка падает в отдельный канал и пингуется только роль
        // разработчика — Support не дёргаем на баги в самом боте.
        standalone: true,
        descriptionLabel: 'Что не работает? Опиши шаги по порядку',
        descriptionPlaceholder: '1) Что делал 2) Что ожидал 3) Что произошло. Приложи ссылку на скрин/видео.',
    },
    {
        value: 'report',
        label: 'Жалоба на игрока',
        requiresTargetUser: true,
        descriptionLabel: 'Что нарушил игрок?',
        descriptionPlaceholder: 'Приложи ссылку на сообщение или скрин-доказательство.',
    },
    {
        value: 'appeal',
        label: 'Обжалование наказания',
        descriptionLabel: 'За что наказание и почему оно ошибочно?',
        descriptionPlaceholder: 'Укажи тип наказания (бан/мут/варн) и свою версию произошедшего.',
    },
    {
        value: 'other',
        label: 'Другое',
        descriptionLabel: 'Опиши свой вопрос подробно',
    },
];

// support/ModerateMembers/Administrator — обычный штат; reasonRoleIds —
// специалист по конкретной теме (например, роль разработчика для багов)
// тоже считается staff — иначе роль была бы чисто пинг-уведомлением без
// реальной возможности нажать "Наказать"/"Снять наказание" на карточке.
function isStaff(config, member) {
    if (config.supportRoleId && member.roles.cache.has(config.supportRoleId)) return true;
    if (Object.values(config.reasonRoleIds).some(id => id && member.roles.cache.has(id))) return true;
    return (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ModerateMembers)
    );
}

// Сколько жалоб на того же игрока уже было за последние windowMs —
// снимок в момент отправки формы, чтобы модератор сразу видел повторного
// нарушителя прямо в карточке, а не искал историю руками.
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

// НЕ <@id> — упоминание нарушителя в карточке запинговало бы его самого
// уведомлением о жалобе на себя. targetTag — снимок tag'а на момент
// отправки формы (сохраняется в extra, не дёргаем Discord API из чистого
// билдера); может быть null, если фетч не удался — тогда просто ID.
function formatReportedUser(targetId, targetTag) {
    return targetTag ? `${targetTag} (\`${targetId}\`)` : `\`${targetId}\``;
}

// Короткая подпись на кнопке — полный REASONS[].label слишком длинный и
// разъезжается в сетке кнопок; на кнопке достаточно одного слова, полное
// название и так есть в тексте панели выше.
const REASON_BUTTON_LABELS = {
    general: 'Общий',
    bug: 'Баг',
    report: 'Жалоба',
    appeal: 'Апелляция',
    other: 'Другое',
};

// Общий сборщик — заголовок с описанием, список тем текстом и ряды кнопок
// под ним (до 4 в ряд — ограничение Discord). Без картинок и повторяющихся
// подписей — короткое имя темы на кнопке, все кнопки одного (серого)
// цвета. Переиспользуется и основной панелью, и отдельной панелью багов
// (buildBugPanelMessage) — разница только в наборе тем и заголовке.
function buildReasonPanelMessage(reasons, title, description) {
    const container = baseContainer(COLORS.primary)
        .addTextDisplayComponents(textDisplay(formatBody(title, description)))
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            textDisplay(reasons.map(r => `**${r.label}** — ${r.descriptionLabel ?? ''}`).join('\n'))
        );

    const buttons = reasons.map(r =>
        new ButtonBuilder()
            .setCustomId(`${OPEN_REASON_PREFIX}${r.value}`)
            .setLabel(REASON_BUTTON_LABELS[r.value] ?? r.label)
            .setStyle(ButtonStyle.Secondary)
    );
    const rows = [];
    for (let i = 0; i < buttons.length; i += 4) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 4)));
    }

    return toMessage(container, ...rows);
}

// Основная панель — все темы, кроме отмеченных standalone (см. REASONS
// "bug": у неё своя отдельная панель/канал, buildBugPanelMessage ниже).
function buildPanelMessage() {
    return buildReasonPanelMessage(
        REASONS.filter(r => !r.standalone),
        'Поддержка сервера',
        'Выбери тему обращения кнопкой ниже — откроется короткая форма, заполненная форма сразу уходит команде поддержки.'
    );
}

// Отдельная панель для тем со standalone: true — сейчас это только "bug".
function buildBugPanelMessage() {
    return buildReasonPanelMessage(
        REASONS.filter(r => r.standalone),
        'Баг-репорты',
        'Нашёл баг в работе бота? Опиши его кнопкой ниже — форма уйдёт прямо разработчику.'
    );
}

// Карточка, которая падает в канал стафу по итогам отправленной формы —
// плоское сообщение без кнопок жизненного цикла (не нужны, у формы нет
// стадий). "Наказать" — только если есть targetId (жалоба на игрока),
// "Снять наказание" — только у обжалования (снимает мут с самого автора,
// апеллировать можно только мут, см. utils/punishmentNotice.js).
function buildSubmissionCard(reason, authorId, description, { targetId, targetTag, reportHistoryCount } = {}) {
    const container = baseContainer(COLORS.primary)
        .addTextDisplayComponents(textDisplay(formatBody(reason.label, description)))
        .addSeparatorComponents(separator());

    const infoLines = [`**От:** <@${authorId}>`];
    if (targetId) {
        infoLines.push(`**Жалоба на:** ${formatReportedUser(targetId, targetTag)}`);
        if (reportHistoryCount > 1) {
            infoLines.push(`**История:** ${reportHistoryCount} жалоб(ы) за 30 дней`);
        }
    }
    container.addTextDisplayComponents(textDisplay(infoLines.join('\n')));

    const row = new ActionRowBuilder();
    if (targetId) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_punish:${targetId}`)
                .setLabel('Наказать')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    if (reason.value === 'appeal') {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_unpunish:${authorId}`)
                .setLabel('Снять наказание')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return row.components.length ? [container, row] : [container];
}

// Отправляет заполненную форму — определяет канал по теме (bug — свой,
// остальные — общий submissionsChannelId), для жалоб на игрока считает и
// сохраняет историю (countRecentReportsOn/config.reports), собирает и
// отправляет карточку с пингом автора и профильных ролей. Никакого
// треда/записи о "тикете" не заводится — само сообщение и есть форма.
async function submitForm(interaction, reason, description, extra = {}) {
    const guild = interaction.guild;
    const now = Date.now();

    // Подсчёт истории и запись новой жалобы — одной атомарной операцией
    // (лок update()), иначе два почти одновременных клика могли бы оба
    // прочитать историю до того, как друг друга запишут, и оба увидеть
    // число на единицу меньше настоящего.
    let reportHistoryCount = 0;
    if (extra.targetId) {
        reportHistoryCount = await update(c => {
            const count = countRecentReportsOn(c.reports, extra.targetId, now, REPORT_HISTORY_WINDOW_MS);
            c.reports.push({ targetUserId: extra.targetId, createdAt: now });
            return count;
        });
    }

    const config = await load();
    const channelId = reason.standalone ? config.bugChannelId : config.submissionsChannelId;
    const channel = channelId
        ? (guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null)))
        : null;
    if (!channel) {
        return { error: 'Система обращений не настроена (нет канала для формы). Обратись к администратору.' };
    }

    const pings = reason.standalone
        ? [config.reasonRoleIds[reason.value]].filter(Boolean)
        : [config.supportRoleId, config.reasonRoleIds[reason.value]].filter(Boolean);
    const uniquePings = [...new Set(pings)].map(id => `<@&${id}>`);
    const cardComponents = buildSubmissionCard(reason, interaction.user.id, description, {
        targetId: extra.targetId ?? null,
        targetTag: extra.targetTag ?? null,
        reportHistoryCount,
    });
    // Пинг — отдельным TextDisplay первым компонентом, а не через content:
    // сообщение с флагом IsComponentsV2 не может содержать content/embeds
    // (см. utils/components.js). Упоминания внутри TextDisplay всё равно
    // доставляют уведомление.
    const payload = uniquePings.length
        ? toMessage(textDisplay(uniquePings.join(' ')), ...cardComponents)
        : toMessage(...cardComponents);

    // Отправка — единственное, без чего форма не доходит до стафа; один
    // повтор через секунду покрывает единичный сбой нестабильной сети до
    // Discord API (тот же приём, что был у createTicket раньше).
    let sent = false;
    for (let attempt = 0; attempt < 2 && !sent; attempt++) {
        try {
            await channel.send(payload);
            sent = true;
        } catch (err) {
            console.error(`tickets: не удалось отправить карточку формы (попытка ${attempt + 1} из 2):`, err);
            if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    if (!sent) {
        return { error: 'Не получилось доставить форму стафу — попробуй ещё раз чуть позже.' };
    }

    return { ok: true };
}

// Наказание по кнопке "Наказать" на карточке жалобы — targetId зашит в
// customId самой кнопки (нет отдельной записи "тикета", откуда его можно
// было бы прочитать). contextLabel — ссылка на карточку-сообщение, идёт в
// audit-лог и в уведомление наказанному вместо номера тикета.
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

// Снять мут с автора обжалования — кнопка "Снять наказание"
// (buildSubmissionCard, только у reasonValue "appeal"). Доступ уже
// проверен вызывающим кодом (handlers.js — isStaff), moderation сама
// разбирается, был ли участник вообще замучен (wasMuted в ответе).
async function unpunishTicketOwner(interaction, ownerId) {
    return moderation.unmuteMember(interaction.guild, ownerId);
}

module.exports = {
    REASONS,
    REASON_BUTTON_LABELS,
    OPEN_REASON_PREFIX,
    REPORT_HISTORY_WINDOW_MS,
    isStaff,
    countRecentReportsOn,
    formatDuration,
    formatReportedUser,
    buildPanelMessage,
    buildBugPanelMessage,
    buildSubmissionCard,
    submitForm,
    punishReportedUser,
    unpunishTicketOwner,
};
