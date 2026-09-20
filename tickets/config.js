const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'tickets';

// Форма записи в tickets (для справки, схема не валидируется):
// {
//   number, ownerId, reason, reasonValue, description,
//   claimedBy, status: 'open' | 'waiting_on_user' | 'resolved',
//   isThread,                    // true — новые тикеты (тред), false/undefined — старые (канал)
//   createdAt, lastActivityAt, claimedAt, closedAt, closedBy,
//   escalatedAt, warnedAt,       // метки, чтобы не слать повторные напоминания
//   rating, ratedAt,             // оценка автора после закрытия
//   notesThreadId,               // приватный тред с внутренними заметками staff (создаётся лениво,
//                                // либо сразу при создании — если у темы есть staffChecklist)
//   voiceChannelId, rootMessageId,
//   reasonValue,                 // REASONS[].value ("bug"/"report"/...) — reason сам по себе только
//                                // отображаемая метка (REASONS[].label), по ней не найти обратно
//                                // тему, чтобы проверить специалист-роль (isStaff) или standalone-панель
//   reportedUserId,              // для темы "Жалоба на игрока" — ID выбранный через UserSelectMenu
//   reportedUserTag,             // tag нарушителя на момент создания тикета — для отображения БЕЗ
//                                // <@id>-упоминания (см. model.formatReportedUser): упоминание
//                                // нарушителя в сообщении внутри треда добавило бы его самого в
//                                // участники этого приватного треда — он увидел бы жалобу на себя.
//                                // Может быть null у тикетов, созданных до этого поля.
//   reportHistoryCount,          // сколько жалоб на этого же игрока было за последние 30 дней
//   urgent,                      // true у тем с REASONS[].urgent, либо переключается вручную кнопкой
//                                // "Приоритет" (доступна автору тикета и staff) — эскалируется быстрее
//                                // (urgentClaimTimeoutMs), видно в /ticket list (сортировка) и отдельной
//                                // строкой в карточке тикета (buildTicketCard); в имени треда не
//                                // отображается вообще — как и статус, по фидбэку администратора
//                                // эмодзи-маркеры в имени треда убрали полностью
//   ownerNotifiedAt,             // когда автору последний раз слали DM-напоминание ответить
//   firstStaffReplyAt,           // когда staff первый раз ответил в тикете — для /ticket stats
//                                // (averageFirstResponseMs), не перезаписывается повторно
// }
const DEFAULTS = {
    categoryId: null,
    panelChannelId: null,
    bugPanelChannelId: null,
    logChannelId: null,
    supportRoleId: null,
    betaSupportRoleId: null,
    betaModeratorRoleId: null,
    reviewChannelId: null,
    escalationRoleId: null,
    reasonRoleIds: {},
    claimTimeoutMs: 10 * 60 * 1000,
    urgentClaimTimeoutMs: 5 * 60 * 1000,
    inactivityWarnMs: 24 * 60 * 60 * 1000,
    inactivityCloseMs: 48 * 60 * 60 * 1000,
    ownerReminderMs: 6 * 60 * 60 * 1000,
    ticketCooldownMs: 5 * 60 * 1000,
    counter: 0,
    tickets: {},
};

function normalize(data) {
    return {
        ...DEFAULTS,
        ...data,
        reasonRoleIds: { ...DEFAULTS.reasonRoleIds, ...data.reasonRoleIds },
        tickets: { ...data.tickets },
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
