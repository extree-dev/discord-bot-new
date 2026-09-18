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
//   notesThreadId,               // приватный тред с внутренними заметками staff (создаётся лениво)
// }
const DEFAULTS = {
    categoryId: null,
    panelChannelId: null,
    logChannelId: null,
    supportRoleId: null,
    escalationRoleId: null,
    reasonRoleIds: {},
    claimTimeoutMs: 10 * 60 * 1000,
    inactivityWarnMs: 24 * 60 * 60 * 1000,
    inactivityCloseMs: 48 * 60 * 60 * 1000,
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
