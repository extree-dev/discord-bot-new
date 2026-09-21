const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'tickets';

// Система тикетов — одна форма (жалоба на игрока), по прямому референсу
// администратора: кнопка → модалка с двумя текстовыми полями "тег/ID" и
// "описание" → бот заводит приватный тред в submissionsChannel и
// добавляет туда автора жалобы, дальше стафф отвечает прямо в треде.
// Из старого жизненного цикла оставлены только claim ("Взять в работу" —
// нужен, когда 2-3 модератора разбирают очередь жалоб от сотен
// участников, чтобы не работать по одному тикету вдвоём и видеть, что
// уже подхвачено) и close; эскалация/приоритет/рейтинги/HTML-
// транскрипты/аппрувал для стажёров — по-прежнему не возвращались.
// Общие вопросы, апелляции, баги убраны целиком. См. CHANGELOG.
//
// categoryId — категория, где живут panelChannel/submissionsChannel.
// panelChannelId — публичный канал с кнопкой (видит любой участник,
// писать нельзя, только жать кнопку).
// submissionsChannelId — родитель для тредов жалоб (сам канал видит
// только staff; ManageThreads на нём даёт видеть и приватные треды
// внутри без явного добавления в каждый).
// managementCategoryId/managementChannelId — отдельный канал с панелью
// управления (кнопки "Активные тикеты"/"Статистика", staff-only) — см.
// scripts/setup-ticket-management.js.
// supportRoleId/betaSupportRoleId — Support и Beta-Support; обе роли
// считаются staff (см. tickets/model.js isStaff), но только Support
// (наравне с полным Moderator) — "старший" состав, см. isSeniorStaff.
// counter — сквозной номер тикета для имени треда ("ticket-<N>").
// reports — [{ targetUserId, createdAt }], плоский лог жалоб на игроков
// для подсчёта "N жалоб за 30 дней" (см. model.js countRecentReportsOn)
// — не сами тикеты, просто список для статистики, не чистится никогда.
// ticketsById — { [threadId]: { number, authorId, targetId, targetTag,
// claimedBy, claimedByTag, createdAt } } — активные тикеты для claim-
// статуса в "Активные тикеты"; запись удаляется при closeReport (не
// нужна после закрытия — список активных и так берётся напрямую из
// Discord через fetchActive(), см. listActiveTickets), поэтому карта не
// растёт бесконечно, в отличие от reports.
// lastReportAt — { [authorId]: timestampMs } — когда автор последний раз
// открыл тикет, для антиспам-кулдауна на создание (см. model.js
// TICKET_COOLDOWN_MS/submitReport). В отличие от ticketsById запись не
// удаляется при закрытии тикета — кулдаун отсчитывается от момента
// открытия, а не от активности тикета; карта ограничена числом разных
// авторов, а не числом тикетов, так что тоже не растёт бесконечно.
const DEFAULTS = {
    categoryId: null,
    panelChannelId: null,
    submissionsChannelId: null,
    managementCategoryId: null,
    managementChannelId: null,
    supportRoleId: null,
    betaSupportRoleId: null,
    counter: 0,
    reports: [],
    ticketsById: {},
    lastReportAt: {},
};

function normalize(data) {
    return {
        ...DEFAULTS,
        ...data,
        reports: [...(data.reports ?? [])],
        ticketsById: { ...(data.ticketsById ?? {}) },
        lastReportAt: { ...(data.lastReportAt ?? {}) },
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
