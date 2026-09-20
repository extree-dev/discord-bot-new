// Доменный слой тикетов: правила (кто staff, чей это тикет, какой статус),
// создание/захват/закрытие/переоткрытие тикета, построение embed/кнопок,
// агрегация статистики. Роутинг по customId и события Discord — в
// tickets/handlers.js и tickets/sweep.js.
const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} = require('discord.js');
const { load, update } = require('./config');
const { COLORS, formatBody } = require('../utils/embeds');
const {
    baseContainer,
    textDisplay,
    separator,
    infoContainer,
    warningContainer,
    errorContainer,
    toMessage,
} = require('../utils/components');
const voice = require('../voice');

const STATUS = {
    OPEN: 'open',
    WAITING_ON_USER: 'waiting_on_user',
    RESOLVED: 'resolved',
};

const STATUS_LABELS = {
    [STATUS.OPEN]: 'Открыт',
    [STATUS.WAITING_ON_USER]: 'Ждём ответа автора',
    [STATUS.RESOLVED]: 'Решён',
};

const STATUS_COLORS = {
    [STATUS.OPEN]: COLORS.primary,
    [STATUS.WAITING_ON_USER]: COLORS.warning,
    [STATUS.RESOLVED]: COLORS.success,
};

// customId-префикс кнопки конкретной темы на панели поддержки — общий
// с tickets/handlers.js, поэтому экспортируется, а не только используется
// локально в buildPanelMessage.
const OPEN_REASON_PREFIX = 'ticket_open_reason:';

// descriptionLabel/descriptionPlaceholder — чтобы модалка окна создания
// тикета явно объясняла, что писать, а не показывала одну и ту же общую
// подпись для всех тем (жалоба на баг ждёт совсем не то, что общий вопрос).
// requiresTargetUser — вместо текстового поля с ником/ID нарушителя,
// который автор жалобы не всегда знает как достать, tickets/handlers.js
// сначала показывает UserSelectMenu и передаёт выбранный ID в модалку.
const REASONS = [
    {
        value: 'general',
        label: 'Общий вопрос',
        descriptionLabel: 'Опиши свой вопрос',
        descriptionPlaceholder: 'Например: как получить роль за уровень?',
        welcomeMessage:
            'Мы получили твой вопрос и скоро ответим. Если он решится сам — закрой тикет кнопкой «Закрыть».',
    },
    {
        value: 'bug',
        label: 'Баг / техническая проблема',
        // Отдельная система, а не тема общего тикет-пайплайна: своя
        // кнопка живёт в своём канале (config.bugPanelChannelId, см.
        // scripts/setup-tickets.js), не показывается на общей панели
        // (buildPanelMessage() её фильтрует), пингуется только своя
        // специалист-роль — Support не дёргаем (createTicket). Инженерно
        // это по-прежнему тот же движок (claim/close/notes/шаблоны,
        // /ticket list/stats), просто с другим "входом" и другой
        // ролью-владельцем.
        standalone: true,
        descriptionLabel: 'Что не работает? Опиши шаги по порядку',
        descriptionPlaceholder: '1) Что делал 2) Что ожидал 3) Что произошло. Приложи ссылку на скрин/видео.',
        welcomeMessage:
            'Спасибо за репорт! Если ещё не приложил — пришли скриншот или видео и укажи платформу (ПК/моб.) — это сильно ускорит разбор.',
        staffChecklist: [
            'Проверь, воспроизводится ли баг у тебя',
            'Уточни платформу и версию клиента, если автор не указал',
            'Если баг подтверждён — передай разработчику бота и отметь тикет шаблоном «Баг подтверждён»',
        ],
    },
    {
        value: 'report',
        label: 'Жалоба на игрока',
        requiresTargetUser: true,
        descriptionLabel: 'Что нарушил игрок?',
        descriptionPlaceholder: 'Приложи ссылку на сообщение или скрин-доказательство.',
        welcomeMessage:
            'Жалоба принята в обработку. Если есть ещё скриншоты или ссылки на сообщения с нарушением — прикрепи их сюда, это поможет модератору быстрее принять решение.',
        staffChecklist: [
            'Проверь приложенные доказательства',
            'Посмотри историю сообщений нарушителя в канале, если нужно больше контекста',
            'Прими решение: наказать кнопкой «Наказать» или отклонить шаблоном ответа',
        ],
    },
    {
        value: 'appeal',
        label: 'Обжалование наказания',
        descriptionLabel: 'За что наказание и почему оно ошибочно?',
        descriptionPlaceholder: 'Укажи тип наказания (бан/мут/варн) и свою версию произошедшего.',
        welcomeMessage:
            'Апелляция принята и передана модерации. Дождись решения здесь — повторные обращения по тому же наказанию не ускорят рассмотрение.',
        staffChecklist: [
            'Проверь причину и срок наказания в журнале модерации',
            'Оцени, есть ли основания для смягчения',
            'Прими решение и сообщи автору шаблоном «Апелляция на рассмотрении/отклонена»',
        ],
    },
    {
        value: 'other',
        label: 'Другое',
        descriptionLabel: 'Опиши свой вопрос подробно',
        welcomeMessage: 'Мы получили твоё обращение и скоро ответим.',
    },
];

// Готовые ответы для частых вопросов — /ticket reply <ключ> публикует
// текст в тред от имени бота, чтобы не копипастить одно и то же вручную.
const CANNED_RESPONSES = {
    greeting: {
        label: 'Приветствие',
        text: 'Здравствуйте! Спасибо за обращение — уже разбираемся, ответим в ближайшее время.',
    },
    need_more_info: {
        label: 'Нужно больше информации',
        text: 'Уточните, пожалуйста, подробности — скриншоты или точное описание проблемы помогут быстрее разобраться.',
    },
    duplicate: {
        label: 'Дубликат тикета',
        text: 'У тебя уже есть открытый тикет по этому вопросу — продолжим общение там, этот закрываем.',
    },
    escalated: {
        label: 'Передано администрации',
        text: 'Вопрос передан администрации для решения. Как появится ответ — сообщим здесь же.',
    },
    rules_reminder: {
        label: 'Напоминание правил',
        text: 'Пожалуйста, ознакомься с правилами сервера в #правила — это поможет избежать повторных нарушений.',
    },
    bug_confirmed: {
        label: 'Баг подтверждён',
        text: 'Баг подтверждён и передан разработчику бота. Спасибо за репорт! Как исправят — сообщим здесь.',
    },
    bug_cannot_reproduce: {
        label: 'Не удалось воспроизвести',
        text: 'Не получилось воспроизвести проблему по описанию. Пришли, пожалуйста, точные шаги, скриншот/видео и платформу (ПК/моб.).',
    },
    report_reviewing: {
        label: 'Жалоба на рассмотрении',
        text: 'Жалоба принята и передана на рассмотрение модерации. Решение по ней сообщим здесь же.',
    },
    report_no_evidence: {
        label: 'Не хватает доказательств',
        text: 'Пока не хватает доказательств для решения — пришли, пожалуйста, скриншот или ссылку на сообщение с нарушением.',
    },
    appeal_reviewing: {
        label: 'Апелляция на рассмотрении',
        text: 'Апелляция принята и передана на рассмотрение модерации. Ответим здесь же после решения.',
    },
    appeal_denied: {
        label: 'Апелляция отклонена',
        text: 'Апелляция отклонена — наказание остаётся в силе. Тикет будет закрыт.',
    },
    closing_soon: {
        label: 'Напоминание перед закрытием',
        text: 'Если вопрос решён — можно закрыть тикет кнопкой «Закрыть». Если нет, напишите, чем можем помочь дальше.',
    },
};

// entry — опционально: если передан и у него есть reasonValue (см.
// createTicket), участник со специалист-ролью именно этой темы
// (config.reasonRoleIds[entry.reasonValue] — например, "Разработчик бота"
// для багов) тоже считается staff ДЛЯ ЭТОГО тикета, даже без Support/
// Moderator. Иначе специалист-роль была бы чисто пинг-уведомлением без
// реальной возможности взять тикет в работу и закрыть его — а с отдельной
// панелью багов (standalone-темы) разработчик как раз и должен вести весь
// жизненный цикл сам, без Support.
function isStaff(config, member, entry = null) {
    if (config.supportRoleId && member.roles.cache.has(config.supportRoleId)) return true;
    // Beta-Support (испытательный срок) не держит ModerateMembers и вообще
    // никаких Discord-прав (как и полноценный Support — доступ к тикетам у
    // обеих ролей даёт не permission, а членство), поэтому без явной
    // проверки роли isStaff() для него всегда возвращал бы false — баг,
    // из-за которого стажёры на испытательном сроке физически не могли
    // работать с тикетами. Beta-Moderator сюда тоже добавлен — формально
    // уже проходит через ModerateMembers ниже, но явная проверка не
    // зависит от того, какие права ему выданы в scripts/setup-roles.js.
    if (config.betaSupportRoleId && member.roles.cache.has(config.betaSupportRoleId)) return true;
    if (config.betaModeratorRoleId && member.roles.cache.has(config.betaModeratorRoleId)) return true;
    if (entry?.reasonValue) {
        const specialistRoleId = config.reasonRoleIds[entry.reasonValue];
        if (specialistRoleId && member.roles.cache.has(specialistRoleId)) return true;
    }
    return (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ModerateMembers)
    );
}

// "Стажёр" — Beta-Moderator/Beta-Support (испытательный срок): isStaff()
// для них тоже true (видят и ведут тикеты как обычный staff), но
// closeTicket() по их запросу не выполняется сразу — уходит на
// подтверждение через requestTicketClosure(), см. handlers.js
// handleCloseButton. Проверка по роли, а не по правам — у Beta-Moderator
// вполне может быть ModerateMembers (см. scripts/setup-roles.js), и
// одного этого недостаточно, чтобы отличить стажёра от полноценного
// Moderator.
function isTrialStaff(config, member) {
    return Boolean(
        (config.betaModeratorRoleId && member.roles.cache.has(config.betaModeratorRoleId)) ||
        (config.betaSupportRoleId && member.roles.cache.has(config.betaSupportRoleId))
    );
}

// "Старший состав" — staff, который сам не на испытательном сроке.
// Только такие могут подтверждать/отклонять закрытие тикета стажёром
// (handlers.js handleCloseApproveButton/handleCloseRejectButton).
function isSeniorStaff(config, member) {
    return isStaff(config, member) && !isTrialStaff(config, member);
}

// Только незакрытые тикеты считаются "уже открытым обращением" — решённые
// остаются в сторе как история (для /mytickets и /ticket stats), поэтому
// findTicketByOwner(), в отличие от старой версии, не должен их находить.
function findOpenTicketByOwner(config, userId) {
    return Object.entries(config.tickets).find(([, t]) => t.ownerId === userId && t.status !== STATUS.RESOLVED);
}

// Антиспам на повторное открытие: пока не прошёл ticketCooldownMs с
// момента закрытия предыдущего тикета этого автора — новый не открыть.
// Не мешает findOpenTicketByOwner (тот уже блокирует, если тикет вообще
// не закрыт) — это отдельная проверка именно на скорость повторного
// открытия после закрытия.
function findRecentlyClosedTicketByOwner(config, userId, now, cooldownMs) {
    return Object.entries(config.tickets).find(
        ([, t]) => t.ownerId === userId && t.status === STATUS.RESOLVED && t.closedAt && now - t.closedAt < cooldownMs
    );
}

// Сколько жалоб на того же игрока (reportedUserId) уже было за последние
// windowMs — снимок в момент создания тикета, чтобы модератор сразу видел
// повторного нарушителя в самой карточке, а не искал историю руками.
function countRecentReportsOn(config, reportedUserId, now, windowMs) {
    return Object.values(config.tickets).filter(
        e => e.reportedUserId === reportedUserId && now - e.createdAt <= windowMs
    ).length;
}
const REPORT_HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Пока тикет не взят в работу — закрыть может автор или любой staff.
// После взятия в работу круг сужается: автор, тот, кто взял, или
// админ (просто модератор — уже нет, чтобы не мешать тому, кто ведёт
// обращение).
function canCloseTicket(config, entry, member) {
    const isOwner = entry.ownerId === member.id;
    if (!entry.claimedBy) {
        return isOwner || isStaff(config, member, entry);
    }
    const isClaimer = entry.claimedBy === member.id;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    return isOwner || isClaimer || isAdmin;
}

// "2 д 3 ч", "45 мин", "<1 мин" — используется в /ticket list, /ticket
// stats и сообщениях эскалации. Чистая функция — без обращений к Discord.
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

// Сколько тикетов закрыл каждый staff и средняя оценка — по всем записям
// в сторе (закрытые тикеты не удаляются, только помечаются RESOLVED).
function aggregateStats(config) {
    const perStaff = {};
    let ratingSum = 0;
    let ratedCount = 0;

    function getStats(staffId) {
        if (!perStaff[staffId]) {
            perStaff[staffId] = { closed: 0, totalResolveMs: 0, ratingSum: 0, ratedCount: 0 };
        }
        return perStaff[staffId];
    }

    for (const entry of Object.values(config.tickets)) {
        if (entry.status !== STATUS.RESOLVED) continue;
        if (typeof entry.rating === 'number') {
            ratingSum += entry.rating;
            ratedCount += 1;
            // Оценка относится к тому, кто вёл тикет (claimedBy), а не к
            // тому, кто его закрыл (closedBy) — закрыть может и сам автор
            // обращения, и он не "модератор" для целей рейтинга.
            if (entry.claimedBy) {
                const stats = getStats(entry.claimedBy);
                stats.ratingSum += entry.rating;
                stats.ratedCount += 1;
            }
        }
        if (!entry.closedBy) continue;
        const stats = getStats(entry.closedBy);
        stats.closed += 1;
        if (typeof entry.closedAt === 'number' && typeof entry.createdAt === 'number') {
            stats.totalResolveMs += entry.closedAt - entry.createdAt;
        }
    }

    return { perStaff, averageRating: ratedCount ? ratingSum / ratedCount : null, ratedCount };
}

// Короткая подпись на кнопке — полный REASONS[].label ("Баг / техническая
// проблема") слишком длинный и разъезжается в сетке кнопок; на кнопке
// достаточно одного слова, полное название и так есть в тексте выше.
const REASON_BUTTON_LABELS = {
    general: 'Общий',
    bug: 'Баг',
    report: 'Жалоба',
    appeal: 'Апелляция',
    other: 'Другое',
};

// Общий сборщик — заголовок с описанием, список тем текстом и ряды кнопок
// под ним (до 4 в ряд — ограничение Discord). Без картинок и повторяющихся
// подписей на каждой строке — короткое имя темы на кнопке, все кнопки
// одного (серого) цвета, чтобы не рябило в глазах. Переиспользуется и
// основной панелью, и отдельной панелью багов (buildBugPanelMessage) —
// разница только в наборе тем и заголовке.
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
// "bug": у них своя отдельная панель/канал, buildBugPanelMessage ниже).
function buildPanelMessage() {
    return buildReasonPanelMessage(
        REASONS.filter(r => !r.standalone),
        'Поддержка сервера',
        'Выбери тему обращения кнопкой ниже — откроется приватный тред с командой поддержки, ' +
            'который увидишь только ты и staff.'
    );
}

// Отдельная панель для тем со standalone: true — сейчас это только "bug".
// Публикуется в свой канал (config.bugPanelChannelId, см.
// scripts/setup-tickets.js) вместо основного, но ведёт себя как обычная
// тема тикетов — тот же createTicket()/claim/close/notes/шаблоны.
function buildBugPanelMessage() {
    return buildReasonPanelMessage(
        REASONS.filter(r => r.standalone),
        'Баг-репорты',
        'Нашёл баг в работе бота? Опиши его кнопкой ниже — откроется приватный тред с разработчиком.'
    );
}

// entry — опционально: кнопка "Наказать" появляется только у тикетов
// с указанным нарушителем (reportedUserId), остальные её не видят. Все
// кнопки одного (серого) цвета — разноцветные "Закрыть"/"Наказать" на
// общем сером фоне рябили в глазах, не давая настоящего сигнала важности.
function buildTicketControlRow(entry = null) {
    const secondRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_voice').setLabel('Обсудить голосом').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ticket_note').setLabel('Заметка (staff)').setStyle(ButtonStyle.Secondary)
    );
    if (entry?.reportedUserId) {
        secondRow.addComponents(
            new ButtonBuilder().setCustomId('ticket_punish').setLabel('Наказать').setStyle(ButtonStyle.Secondary)
        );
    }
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Взять в работу').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ticket_adduser')
                .setLabel('Добавить участника')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Закрыть').setStyle(ButtonStyle.Secondary)
        ),
        secondRow,
    ];
}

// Текстовый степпер статуса вместо цветного поля embed'а: три стадии
// жизненного цикла тикета (Открыт → В работе → Решён), текущая — жирным.
// WAITING_ON_USER не отдельная стадия степпера (она возможна только
// после claim, см. recordActivity), а уточнение внутри стадии "В работе".
function buildStatusStepper(entry) {
    const steps = ['Открыт', 'В работе', 'Решён'];
    const activeIndex = entry.status === STATUS.RESOLVED ? 2 : entry.claimedBy ? 1 : 0;
    let line = steps.map((label, i) => (i === activeIndex ? `**${label}**` : label)).join(' → ');
    if (entry.status === STATUS.WAITING_ON_USER) line += ' _(ждём ответа автора)_';
    return line;
}

// Карточка тикета на Components V2 вместо embed'а с полями-сеткой —
// стопка текстовых блоков, разделённых Separator, тот же смысл, что был
// у fields, но без грид-раскладки embed'а и без эмодзи-маркеров (см.
// договорённость по редизайну тикетов — только текст).
function buildTicketCard(entry) {
    const headerText = formatBody(
        entry.urgent ? `Тикет #${entry.number} — срочно` : `Тикет #${entry.number}`,
        entry.description
    );
    const container = baseContainer(STATUS_COLORS[entry.status] ?? COLORS.primary)
        .addTextDisplayComponents(textDisplay(headerText))
        .addSeparatorComponents(separator());

    const infoLines = [
        `**Тема:** ${entry.reason}`,
        `**Статус:** ${buildStatusStepper(entry)}`,
        `**Взял в работу:** ${entry.claimedBy ? `<@${entry.claimedBy}>` : 'никто'}`,
    ];
    if (entry.reportedUserId) {
        infoLines.push(`**Жалоба на:** <@${entry.reportedUserId}>`);
        if (entry.reportHistoryCount > 1) {
            infoLines.push(`**История:** ${entry.reportHistoryCount} жалоб(ы) за 30 дней`);
        }
    }
    container.addTextDisplayComponents(textDisplay(infoLines.join('\n')));
    return container;
}

// extra.reportedUserId — заполняется только для тем с requiresTargetUser
// (сейчас это "Жалоба на игрока"): ID выбирается через UserSelectMenu в
// handlers.js, а не вписывается вручную в текстовое поле модалки.
async function createTicket(interaction, reason, description, extra = {}) {
    const guild = interaction.guild;
    const member = interaction.member;

    // Проверка "тикет уже есть" и резервирование номера должны быть
    // одной атомарной операцией — иначе два клика (или два разных
    // пользователя, задевших counter почти одновременно) могут
    // получить один и тот же номер. Лок держим только на это быстрое
    // чтение+инкремент, не на медленный API-вызов создания треда.
    const reservation = await update(config => {
        const existing = findOpenTicketByOwner(config, member.id);
        if (existing) {
            return { error: `У тебя уже открыт тикет: <#${existing[0]}>` };
        }
        config.counter += 1;
        return {
            number: config.counter,
            panelChannelId:
                reason.standalone && config.bugPanelChannelId ? config.bugPanelChannelId : config.panelChannelId,
            supportRoleId: config.supportRoleId,
            reasonRoleId: config.reasonRoleIds[reason.value] ?? null,
            // Снимок на момент создания — сколько жалоб на этого же
            // игрока уже было, чтобы показать в самой карточке тикета
            // (см. buildTicketCard). Считаем здесь же, внутри лока
            // update(), а не отдельным чтением конфига — так число не
            // разъедется с counter при параллельном создании тикетов.
            reportHistoryCount: extra.reportedUserId
                ? countRecentReportsOn(config, extra.reportedUserId, Date.now(), REPORT_HISTORY_WINDOW_MS)
                : 0,
        };
    });

    if (reservation.error) return { error: reservation.error };

    const { number, panelChannelId, supportRoleId, reasonRoleId, reportHistoryCount } = reservation;
    const panelChannel = panelChannelId ? guild.channels.cache.get(panelChannelId) : null;
    if (!panelChannel) {
        return { error: 'Система тикетов не настроена (нет канала для тредов). Обратись к администратору.' };
    }

    const thread = await panelChannel.threads.create({
        // Тема обращения в имени треда (не только номер и ник) — чтобы
        // staff видел, о чём тикет, прямо в списке тредов, без клика.
        name: `тикет-${number}-${reason.value}-${member.user.username}`.slice(0, 95).toLowerCase(),
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Тикет #${number} от ${member.user.tag}`,
    });
    await thread.members.add(member.id).catch(() => {});

    const now = Date.now();
    const entry = {
        number,
        ownerId: member.id,
        guildId: guild.id,
        reason: reason.label,
        reasonValue: reason.value,
        description,
        claimedBy: null,
        status: STATUS.OPEN,
        isThread: true,
        createdAt: now,
        lastActivityAt: now,
        claimedAt: null,
        closedAt: null,
        closedBy: null,
        escalatedAt: null,
        warnedAt: null,
        rating: null,
        ratedAt: null,
        notesThreadId: null,
        voiceChannelId: null,
        reportedUserId: extra.reportedUserId ?? null,
        reportHistoryCount,
        urgent: Boolean(reason.urgent),
        ownerNotifiedAt: null,
        rootMessageId: null,
    };
    await update(cfg => {
        cfg.tickets[thread.id] = entry;
    });

    // standalone-темы (сейчас — bug) не дёргают Support вообще, это же
    // разделение и было целью отдельной панели — Support не должен видеть
    // пинг по каждому баг-репорту, только своя специалист-роль.
    const pings = reason.standalone ? [reasonRoleId].filter(Boolean) : [supportRoleId, reasonRoleId].filter(Boolean);
    const uniquePings = [...new Set(pings)].map(id => `<@&${id}>`);

    // Пинг автора и ролей — как текстовый блок компонента, а не через
    // content: сообщение с флагом IsComponentsV2 не может содержать
    // content/embeds, только components (см. utils/components.js).
    // Упоминания внутри TextDisplay всё равно доставляют уведомление.
    const pingLine = `${member}${uniquePings.length ? ' ' + uniquePings.join(' ') : ''}`;

    // rootMessageId запоминаем, чтобы claim/reopen/смена статуса могли
    // обновить именно это сообщение в месте, а не только слать новое —
    // иначе "Взял в работу: никто" навсегда остаётся в начале треда.
    const rootMessage = await thread.send(
        toMessage(textDisplay(pingLine), buildTicketCard(entry), ...buildTicketControlRow(entry))
    );
    await update(cfg => {
        const e = cfg.tickets[thread.id];
        if (e) e.rootMessageId = rootMessage.id;
    });

    // Короткая приветственная подсказка под конкретную тему — сразу
    // намекает, что уточнить/приложить, а не только фиксирует факт
    // создания тикета (это уже показывает rootMessage выше).
    if (reason.welcomeMessage) {
        await thread.send(toMessage(infoContainer(reason.welcomeMessage, 'Пока ждёшь ответа'))).catch(() => {});
    }

    // Мини-чеклист для staff под конкретную тему — сразу в тред заметок
    // (создаём его сейчас же, а не лениво при первом /ticket note, только
    // если у темы есть готовый чеклист: без него пустой тред заметок
    // никому не нужен).
    if (reason.staffChecklist?.length) {
        const notesThread = await createNotesThread(panelChannel, thread.id, number);
        await notesThread
            .send(
                toMessage(
                    infoContainer(
                        reason.staffChecklist.map((step, i) => `${i + 1}. ${step}`).join('\n'),
                        'Чек-лист для staff'
                    )
                )
            )
            .catch(() => {});
    }

    return { thread };
}

// Перерисовывает карточку стартового сообщения тикета (тема/статус/кто
// взял в работу) актуальными данными — вызывается после claim, любой
// активности в треде и reopen, чтобы это сообщение не застревало на
// "Взял в работу: никто" после того, как тикет уже давно взяли.
async function updateTicketRootMessage(client, threadId, entry) {
    if (!entry?.rootMessageId) return;
    const thread = client.channels.cache.get(threadId) ?? (await client.channels.fetch(threadId).catch(() => null));
    if (!thread) return;
    const message = await thread.messages.fetch(entry.rootMessageId).catch(() => null);
    if (!message) return;
    // Компонентное сообщение редактируется целиком (нет частичного
    // патча полей, как у embed'а) — пинг-строка из исходного сообщения
    // не переносится, она была одноразовым уведомлением, не частью
    // карточки. embeds: [] — обязательно явно очистить: если это
    // сообщение создавалось до перехода на Components V2 (старый embed),
    // PATCH без явной очистки оставляет старый embed как есть, и Discord
    // отвергает результат (embeds + IS_COMPONENTS_V2 одновременно).
    await message
        .edit({ ...toMessage(buildTicketCard(entry), ...buildTicketControlRow(entry)), embeds: [] })
        .catch(() => {});
}

// Атомарный захват тикета: перечитывает свежие данные внутри лока и
// проверяет claimedBy ещё раз (вдруг кто-то другой забрал тикет за то
// время, пока вызывающий код читал config до этого) и сразу применяет
// side-эффект (добавление в тред) — доступ к треду такая же часть
// "захвата", как и запись в БД.
async function claimTicket(interaction) {
    const claim = await update(cfg => {
        const entry = cfg.tickets[interaction.channelId];
        if (!entry) return { status: 'gone' };
        if (entry.claimedBy) return { status: 'already-claimed', claimedBy: entry.claimedBy };
        entry.claimedBy = interaction.user.id;
        entry.claimedAt = Date.now();
        entry.status = STATUS.OPEN;
        return { status: 'claimed', entry };
    });

    if (claim.status !== 'claimed') return claim;

    if (interaction.channel.isThread()) {
        await interaction.channel.members.add(interaction.user.id).catch(() => {});
    } else {
        // Обратная совместимость: тикет создан по старой схеме (обычный
        // канал), до перехода на треды.
        await interaction.channel.permissionOverwrites
            .edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true,
                ManageMessages: true,
                ReadMessageHistory: true,
            })
            .catch(() => {});
    }

    return claim;
}

// Даёт участнику доступ к тикету и возвращает его User (для сообщения-
// подтверждения) — сама выдача доступа такая же часть домена "добавить
// участника в тикет", как и то, кому конкретно это разрешено.
async function addTicketMember(interaction, targetId) {
    if (interaction.channel.isThread()) {
        await interaction.channel.members.add(targetId).catch(() => {});
    } else {
        await interaction.channel.permissionOverwrites
            .edit(targetId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true })
            .catch(() => {});
    }
    return interaction.guild.members.cache.get(targetId)?.user ?? interaction.client.users.cache.get(targetId) ?? null;
}

// Наказание нарушителя прямо из тикета «Жалоба на игрока» — без выхода
// в /ban или /timeout руками. action — 'ban' или 'mute:<секунды>'.
// Право на конкретное действие проверяем по настоящим Discord-правам
// исполнителя (BanMembers/ModerateMembers), а не по isStaff() — роль
// Support сама по себе не должна давать возможность банить/мутить,
// если у неё нет соответствующего права на сервере.
async function punishReportedUser(interaction, entry, action) {
    if (!entry.reportedUserId) return { error: 'В этом тикете не указан нарушитель.' };
    const targetId = entry.reportedUserId;
    const guild = interaction.guild;
    const auditReason = `Тикет #${entry.number}, модератор ${interaction.user.tag}`;

    if (action === 'ban') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return { error: 'У тебя нет права банить участников.' };
        }
        const member = await guild.members.fetch(targetId).catch(() => null);
        if (member && !member.bannable) {
            return { error: 'Не могу забанить этого участника (недостаточно прав или роль выше моей).' };
        }
        await guild.members.ban(targetId, { reason: auditReason });
        return { label: 'забанен' };
    }

    const seconds = Number(action.split(':')[1]);
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return { error: 'У тебя нет права мутить участников.' };
    }
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) return { error: 'Участник не найден на сервере.' };
    if (!member.moderatable) {
        return { error: 'Не могу замутить этого участника (недостаточно прав или роль выше моей).' };
    }
    await member.timeout(seconds * 1000, auditReason);
    return { label: `замучен на ${formatDuration(seconds * 1000)}` };
}

// Голосовая комната для обсуждения тикета — создаётся как обычный voice-
// канал, но регистрируется в системе временных комнат (voice.trackRoom),
// чтобы её удаление при опустении обрабатывал уже существующий механизм
// tempvoice, а не отдельная копия той же логики здесь.
async function createDiscussionVoiceChannel(interaction, entry) {
    const guild = interaction.guild;
    const config = await load();
    const category = config.categoryId ? guild.channels.cache.get(config.categoryId) : null;

    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
            id: entry.ownerId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
        },
    ];
    if (entry.claimedBy && entry.claimedBy !== entry.ownerId) {
        overwrites.push({
            id: entry.claimedBy,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
        });
    }

    const channel = await guild.channels.create({
        name: `тикет-${entry.number}-голос`.slice(0, 95).toLowerCase(),
        type: ChannelType.GuildVoice,
        parent: category?.id ?? null,
        permissionOverwrites: overwrites,
    });

    await voice.trackRoom(channel.id, entry.ownerId);
    return channel;
}

// Переиспользует уже созданную для этого тикета голосовую комнату,
// если она ещё существует (повторный клик "Обсудить голосом" не должен
// плодить второй канал и терять ссылку на первый), иначе создаёт новую
// и запоминает её id на entry — без этого closeTicket не знал бы, какой
// канал удалять при закрытии тикета.
async function getOrCreateDiscussionVoiceChannel(interaction, entry) {
    if (entry.voiceChannelId) {
        const existing =
            interaction.guild.channels.cache.get(entry.voiceChannelId) ??
            (await interaction.guild.channels.fetch(entry.voiceChannelId).catch(() => null));
        if (existing) return { channel: existing, created: false };
    }

    const channel = await createDiscussionVoiceChannel(interaction, entry);
    await update(cfg => {
        const e = cfg.tickets[interaction.channelId];
        if (e) e.voiceChannelId = channel.id;
    });
    return { channel, created: true };
}

// Общая часть создания треда заметок — вынесена, чтобы createTicket
// (нет никакого interaction внутри уже созданного треда, только сам
// panelChannel) мог завести notes-тред сразу под staffChecklist, не
// подставляя туда чужой interaction.channelId по ошибке.
async function createNotesThread(parentChannel, threadId, number) {
    const notesThread = await parentChannel.threads.create({
        name: `тикет-${number}-заметки`.slice(0, 95).toLowerCase(),
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Заметки staff по тикету #${number}`,
    });
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (e) e.notesThreadId = notesThread.id;
    });
    return notesThread;
}

// Приватный тред с внутренними заметками staff, отдельный от основного
// тикета (чтобы автор обращения их не видел) — создаётся лениво при
// первом /ticket note и переиспользуется дальше (либо сразу при
// createTicket, если у темы есть staffChecklist — см. createNotesThread
// выше). Участники добавляются по одному по мере использования команды,
// а не массово по роли — Discord не даёт добавить в тред "всех с ролью
// X" одним вызовом API.
async function getOrCreateNotesThread(interaction, entry) {
    if (entry.notesThreadId) {
        const existing =
            interaction.guild.channels.cache.get(entry.notesThreadId) ??
            (await interaction.guild.channels.fetch(entry.notesThreadId).catch(() => null));
        if (existing) return existing;
    }

    const parent = interaction.channel.isThread() ? interaction.channel.parent : interaction.channel;
    return createNotesThread(parent, interaction.channelId, entry.number);
}

// approvedBy — только когда закрытие прошло через requestTicketClosure()
// (closedBy тогда — тот, кто ЗАПРОСИЛ закрытие, обычно стажёр, чтобы
// статистика/лог отражали, кто реально вёл тикет, а не кто нажал
// последнюю кнопку) — добавляет отдельную строку в лог, кто подтвердил.
async function closeTicket(guild, channel, entry, closedBy, approvedBy = null) {
    const config = await load();

    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    const sorted = messages ? [...messages.values()].reverse() : [];
    const lines = sorted.map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content || '(вложение/embed)'}`);
    const transcriptText = lines.length ? lines.join('\n') : 'Сообщений нет.';
    const transcript = new AttachmentBuilder(Buffer.from(transcriptText, 'utf8'), {
        name: `ticket-${entry.number}.txt`,
    });

    const now = Date.now();
    const logChannel = config.logChannelId ? guild.channels.cache.get(config.logChannelId) : null;
    if (logChannel) {
        const owner = await guild.members.fetch(entry.ownerId).catch(() => null);
        const logLines = [
            `**Открыл:** ${owner ? `${owner}` : entry.ownerId}`,
            `**Тема:** ${entry.reason}`,
            `**Закрыл:** ${closedBy ? `<@${closedBy}>` : 'автоматически (неактивность)'}`,
            `**Взял в работу:** ${entry.claimedBy ? `<@${entry.claimedBy}>` : 'никто'}`,
            `**Время решения:** ${formatDuration(now - entry.createdAt)}`,
        ];
        if (approvedBy) logLines.push(`**Подтвердил:** <@${approvedBy}>`);
        if (entry.reportedUserId) logLines.push(`**Жалоба на:** <@${entry.reportedUserId}>`);
        const logCard = baseContainer(COLORS.primary)
            .addTextDisplayComponents(textDisplay(formatBody(`Тикет #${entry.number} закрыт`)))
            .addSeparatorComponents(separator())
            .addTextDisplayComponents(textDisplay(logLines.join('\n')));
        await logChannel.send({ ...toMessage(logCard), files: [transcript] }).catch(() => {});
    }

    // Запись о тикете НЕ удаляется (в отличие от старой версии) — она
    // остаётся в сторе со статусом RESOLVED для /mytickets и /ticket
    // stats. Через update(), а не "load-в-начале-функции + save()" —
    // между началом closeTicket и этой строкой были await'ы (fetch
    // сообщений, отправка лога), за которые кто-то другой мог успеть
    // изменить данные тикетов.
    await update(cfg => {
        const e = cfg.tickets[channel.id];
        if (!e) return;
        e.status = STATUS.RESOLVED;
        e.closedAt = now;
        e.closedBy = closedBy;
        delete e.closeRequestedBy;
        delete e.closeRequestedAt;
        delete e.closeReviewMessageId;
        pruneOldResolved(cfg);
    });

    // Побочные ресурсы тикета (голосовая комната для обсуждения, тред
    // с внутренними заметками staff) не нужны после закрытия — если их
    // не убрать явно, они остаются висеть: голосовой канал — до тех
    // пор, пока кто-то не зайдёт и не выйдет из него, тред с заметками
    // — навсегда (архивировать его бессмысленно, реопенить тикет не
    // восстанавливает доступ к заметкам отдельно).
    if (entry.notesThreadId) {
        const notesThread =
            guild.channels.cache.get(entry.notesThreadId) ??
            (await guild.channels.fetch(entry.notesThreadId).catch(() => null));
        await notesThread?.delete('Тикет закрыт').catch(() => {});
    }
    if (entry.voiceChannelId) {
        const voiceChannel =
            guild.channels.cache.get(entry.voiceChannelId) ??
            (await guild.channels.fetch(entry.voiceChannelId).catch(() => null));
        await voiceChannel?.delete('Тикет закрыт').catch(() => {});
        await voice.untrackRoom(entry.voiceChannelId);
    }

    // Более информативная карточка закрытия для самого треда (не только
    // "Через 5 секунд...", но и тема/кто закрыл/время решения — раньше
    // это было видно только в приватном логе staff).
    const closeCard = baseContainer(COLORS.danger)
        .addTextDisplayComponents(textDisplay(formatBody('Тикет закрывается', 'Тред заархивируется через 5 секунд')))
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            textDisplay(
                [
                    `**Тема:** ${entry.reason}`,
                    `**Закрыл:** ${closedBy ? `<@${closedBy}>` : 'автоматически (неактивность)'}`,
                    ...(approvedBy ? [`**Подтвердил:** <@${approvedBy}>`] : []),
                    `**Время решения:** ${formatDuration(now - entry.createdAt)}`,
                ].join('\n')
            )
        );
    await channel.send(toMessage(closeCard)).catch(() => {});

    setTimeout(async () => {
        if (channel.isThread()) {
            await channel.setLocked(true, 'Тикет закрыт').catch(() => {});
            await channel.setArchived(true, 'Тикет закрыт').catch(() => {});
        } else {
            await channel.delete('Тикет закрыт').catch(() => {});
        }
    }, 5000);

    return { closedAt: now };
}

// Вызывается вместо closeTicket(), когда закрыть тикет пытается стажёр
// (isTrialStaff, см. handlers.js handleCloseButton) — тикет остаётся
// открытым, в reviewChannelId падает карточка с кнопками
// "Подтвердить"/"Отклонить" (handleCloseApproveButton/handleCloseRejectButton),
// а в самом треде — короткое уведомление, чтобы автор тикета не терялся
// в ожидании неизвестно чего.
async function requestTicketClosure(guild, channel, entry, requestedBy) {
    const config = await load();
    const reviewChannel = config.reviewChannelId ? guild.channels.cache.get(config.reviewChannelId) : null;

    await update(cfg => {
        const e = cfg.tickets[channel.id];
        if (!e) return;
        e.closeRequestedBy = requestedBy;
        e.closeRequestedAt = Date.now();
    });

    const requester = await guild.members.fetch(requestedBy).catch(() => null);
    const owner = await guild.members.fetch(entry.ownerId).catch(() => null);

    const card = baseContainer(COLORS.warning)
        .addTextDisplayComponents(
            textDisplay(
                formatBody(
                    `Запрос на закрытие тикета #${entry.number}`,
                    'Стажёр запросил закрытие — нужно подтверждение'
                )
            )
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            textDisplay(
                [
                    `**Тред:** ${channel}`,
                    `**Тема:** ${entry.reason}`,
                    `**Автор тикета:** ${owner ? `${owner}` : entry.ownerId}`,
                    `**Запросил закрытие:** ${requester ? `${requester}` : requestedBy}`,
                ].join('\n')
            )
        );
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket_close_approve:${channel.id}`)
            .setLabel('Подтвердить закрытие')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`ticket_close_reject:${channel.id}`)
            .setLabel('Отклонить')
            .setStyle(ButtonStyle.Secondary)
    );

    let reviewMessageId = null;
    if (reviewChannel) {
        const sent = await reviewChannel.send(toMessage(card, row)).catch(() => null);
        reviewMessageId = sent?.id ?? null;
    }
    if (reviewMessageId) {
        await update(cfg => {
            const e = cfg.tickets[channel.id];
            if (e) e.closeReviewMessageId = reviewMessageId;
        });
    }

    await channel
        .send(
            toMessage(
                warningContainer(
                    'Запрос на закрытие отправлен старшему составу на подтверждение — тикет пока остаётся открытым.',
                    'Ожидает подтверждения'
                )
            )
        )
        .catch(() => {});

    return { reviewChannel: Boolean(reviewChannel) };
}

// Отклонение — тикет остаётся открытым как есть (closeRequestedBy и
// остальные поля запроса снимаются, чтобы кнопка "Закрыть" в треде
// снова вела на обычный путь, а не считалась ещё не отвеченным
// запросом), reason уходит и в тред, и (через handlers.js, у которого
// есть доступ к interaction) в отредактированную карточку канала
// подтверждения.
async function rejectTicketClosure(guild, channel, entry, rejectedBy, reason) {
    await update(cfg => {
        const e = cfg.tickets[channel.id];
        if (!e) return;
        delete e.closeRequestedBy;
        delete e.closeRequestedAt;
        delete e.closeReviewMessageId;
    });

    const rejector = await guild.members.fetch(rejectedBy).catch(() => null);
    await channel
        .send(
            toMessage(
                errorContainer(
                    `Запрос на закрытие отклонён ${rejector ? `${rejector}` : rejectedBy}: ${reason}`,
                    'Закрытие отклонено'
                )
            )
        )
        .catch(() => {});
}

// Хранить резолвнутые тикеты вечно — не лучшая идея (БД будет только
// расти), но и терять историю сразу тоже не нужно (нужна для /mytickets,
// /ticket stats). Компромисс: держим последние KEEP_RESOLVED закрытых
// тикетов, старые вычищаем. Вызывается изнутри update(), мутирует cfg.
const KEEP_RESOLVED = 300;
function pruneOldResolved(cfg) {
    const resolved = Object.entries(cfg.tickets)
        .filter(([, e]) => e.status === STATUS.RESOLVED)
        .sort(([, a], [, b]) => (a.closedAt ?? 0) - (b.closedAt ?? 0));
    const excess = resolved.length - KEEP_RESOLVED;
    for (let i = 0; i < excess; i++) {
        delete cfg.tickets[resolved[i][0]];
    }
}

// Три чистые функции для sweep.js — принимают config и текущее время,
// не трогают Discord API, поэтому легко тестируются без моков.
function findTicketsToEscalate(config, now) {
    return Object.entries(config.tickets).filter(([, e]) => {
        if (!e.isThread || e.status === STATUS.RESOLVED || e.claimedBy || e.escalatedAt) return false;
        // Темы с REASONS[].urgent ждут вдвое меньше обычных, прежде чем
        // эскалироваться (сейчас ни одна тема так не отмечена).
        const timeout = e.urgent ? (config.urgentClaimTimeoutMs ?? config.claimTimeoutMs) : config.claimTimeoutMs;
        return now - e.createdAt >= timeout;
    });
}

function findTicketsToWarn(config, now) {
    return Object.entries(config.tickets).filter(
        ([, e]) => e.status !== STATUS.RESOLVED && !e.warnedAt && now - e.lastActivityAt >= config.inactivityWarnMs
    );
}

function findTicketsToAutoClose(config, now) {
    return Object.entries(config.tickets).filter(
        ([, e]) => e.status !== STATUS.RESOLVED && e.warnedAt && now - e.warnedAt >= config.inactivityCloseMs
    );
}

// Обратная сторона findTicketsToWarn: там напоминаем staff, что автор
// молчит, здесь — напоминаем автору, что staff уже ответил, а он молчит.
// Не пересекается по полям с warnedAt/escalatedAt — ownerNotifiedAt
// сбрасывается в recordActivity(), как только автор сам напишет.
function findTicketsToRemindOwner(config, now) {
    return Object.entries(config.tickets).filter(
        ([, e]) =>
            e.status === STATUS.WAITING_ON_USER &&
            !e.ownerNotifiedAt &&
            now - e.lastActivityAt >= config.ownerReminderMs
    );
}

// Готовый ответ из CANNED_RESPONSES, отправленный от имени бота в
// текущий тред — считается активностью staff (см. recordActivity).
async function postCannedResponse(interaction, key) {
    const canned = CANNED_RESPONSES[key];
    if (!canned) return { error: 'Неизвестный шаблон ответа.' };
    await interaction.channel.send(toMessage(infoContainer(canned.text, canned.label)));
    const updatedEntry = await recordActivity(interaction.channelId, false);
    if (updatedEntry) await updateTicketRootMessage(interaction.client, interaction.channelId, updatedEntry);
    return {};
}

async function markEscalated(threadId) {
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (e) e.escalatedAt = Date.now();
    });
}

async function markWarned(threadId) {
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (e) e.warnedAt = Date.now();
    });
}

async function reopenTicket(guild, number) {
    const config = await load();
    const found = Object.entries(config.tickets).find(([, t]) => t.number === number);
    if (!found) return { error: `Тикет #${number} не найден.` };
    const [threadId, entry] = found;
    if (entry.status !== STATUS.RESOLVED) return { error: `Тикет #${number} не закрыт.` };

    const thread = guild.channels.cache.get(threadId) ?? (await guild.channels.fetch(threadId).catch(() => null));
    if (!thread) {
        return { error: `Тред тикета #${number} не найден (возможно, был создан по старой схеме и уже удалён).` };
    }

    if (thread.isThread()) {
        await thread.setArchived(false, 'Тикет переоткрыт').catch(() => {});
        await thread.setLocked(false, 'Тикет переоткрыт').catch(() => {});
        await thread.members.add(entry.ownerId).catch(() => {});
    }

    const now = Date.now();
    let updatedEntry = null;
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (!e) return;
        e.status = STATUS.OPEN;
        e.closedAt = null;
        e.closedBy = null;
        e.lastActivityAt = now;
        updatedEntry = e;
    });

    if (updatedEntry) {
        await thread.send(toMessage(buildTicketCard(updatedEntry))).catch(() => {});
        await updateTicketRootMessage(guild.client, threadId, updatedEntry);
    }

    return { thread };
}

// DM автору с просьбой оценить работу поддержки — отправляется после
// закрытия тикета. Молча ничего не делает, если DM закрыты (catch).
async function sendRatingRequest(client, entry, threadId) {
    const user = await client.users.fetch(entry.ownerId).catch(() => null);
    if (!user) return;

    const card = infoContainer(
        `Как тебе помогли с тикетом #${entry.number}? Выбери оценку от 1 до 5.`,
        'Оцени поддержку'
    );
    const row = new ActionRowBuilder().addComponents(
        [1, 2, 3, 4, 5].map(n =>
            new ButtonBuilder()
                .setCustomId(`ticket_rate:${threadId}:${n}`)
                .setLabel(`${n}`)
                .setStyle(ButtonStyle.Secondary)
        )
    );
    await user.send(toMessage(card, row)).catch(() => {});
}

// Автоматический статус: ответ staff помечает тикет "ждём автора",
// ответ автора снимает эту пометку. Любая активность сбрасывает
// warnedAt, чтобы не автозакрыть тикет сразу после того, как в нём
// наконец что-то произошло.
async function recordActivity(threadId, authorIsOwner) {
    const now = Date.now();
    let updatedEntry = null;
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (!e || e.status === STATUS.RESOLVED) return;
        e.lastActivityAt = now;
        e.warnedAt = null;
        if (authorIsOwner) {
            if (e.status === STATUS.WAITING_ON_USER) e.status = STATUS.OPEN;
            // Автор ответил — снимаем отметку о напоминании, чтобы
            // следующий период ожидания (если тикет снова затихнет)
            // мог напомнить о себе заново.
            e.ownerNotifiedAt = null;
        } else {
            e.status = STATUS.WAITING_ON_USER;
        }
        updatedEntry = e;
    });
    return updatedEntry;
}

// DM автору, если staff ответил, а от автора давно нет ответа (обратная
// сторона напоминания staff о неактивности — см. findTicketsToWarn) —
// чтобы тикет не затих просто потому, что автор не заметил уведомление
// в самом Discord. Молча ничего не делает, если DM закрыты.
async function sendOwnerReminder(client, entry, threadId) {
    const user = await client.users.fetch(entry.ownerId).catch(() => null);
    if (!user) return;

    const link = entry.guildId ? `https://discord.com/channels/${entry.guildId}/${threadId}` : null;
    const card = warningContainer(
        `Поддержка ответила в тикете #${entry.number}, но мы давно не видели ответа от тебя.` +
            (link ? ` [Перейти в тикет](${link})` : ''),
        'Тикет ждёт твоего ответа'
    );
    await user.send(toMessage(card)).catch(() => {});
}

async function markOwnerNotified(threadId) {
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (e) e.ownerNotifiedAt = Date.now();
    });
}

async function recordRating(threadId, rating) {
    let entry = null;
    await update(cfg => {
        const e = cfg.tickets[threadId];
        if (!e) return;
        e.rating = rating;
        e.ratedAt = Date.now();
        entry = e;
    });
    return entry;
}

module.exports = {
    STATUS,
    STATUS_LABELS,
    STATUS_COLORS,
    REASONS,
    OPEN_REASON_PREFIX,
    CANNED_RESPONSES,
    isStaff,
    isTrialStaff,
    isSeniorStaff,
    findOpenTicketByOwner,
    findRecentlyClosedTicketByOwner,
    canCloseTicket,
    formatDuration,
    aggregateStats,
    findTicketsToEscalate,
    findTicketsToWarn,
    findTicketsToAutoClose,
    findTicketsToRemindOwner,
    markEscalated,
    markWarned,
    markOwnerNotified,
    sendOwnerReminder,
    buildPanelMessage,
    buildBugPanelMessage,
    buildTicketControlRow,
    buildTicketCard,
    buildStatusStepper,
    createTicket,
    updateTicketRootMessage,
    claimTicket,
    addTicketMember,
    punishReportedUser,
    createDiscussionVoiceChannel,
    getOrCreateDiscussionVoiceChannel,
    getOrCreateNotesThread,
    closeTicket,
    requestTicketClosure,
    rejectTicketClosure,
    reopenTicket,
    sendRatingRequest,
    recordActivity,
    recordRating,
    postCannedResponse,
};
