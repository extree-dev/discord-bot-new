const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'tickets';

// Форма записи в tickets (для справки, схема не валидируется):
// {
//   number, ownerId, reason, description,
//   claimedBy, status: 'open' | 'waiting_on_user' | 'resolved',
//   isThread,                    // true — новые тикеты (тред), false/undefined — старые (канал)
//   createdAt, lastActivityAt, claimedAt, closedAt, closedBy,
//   escalatedAt, warnedAt,       // метки, чтобы не слать повторные напоминания
//   rating, ratedAt,             // оценка автора после закрытия
//   notesThreadId,               // приватный тред с внутренними заметками staff (создаётся лениво,
//                                // либо сразу при создании — если у темы есть staffChecklist)
//   voiceChannelId, rootMessageId,
//   reportedUserId,              // для темы "Жалоба на игрока" — ID выбранный через UserSelectMenu
//   reportHistoryCount,          // сколько жалоб на этого же игрока было за последние 30 дней
//   urgent,                      // true у тем с REASONS[].urgent — эскалируется быстрее (urgentClaimTimeoutMs)
//   ownerNotifiedAt,             // когда автору последний раз слали DM-напоминание ответить
// }
const DEFAULTS = {
    categoryId: null,
    panelChannelId: null,
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
