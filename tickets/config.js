const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'tickets';

// Система тикетов — одна форма (жалоба на игрока), по прямому референсу
// администратора: кнопка → модалка с двумя текстовыми полями "тег/ID" и
// "описание" → бот заводит приватный тред в submissionsChannel и
// добавляет туда автора жалобы, дальше стафф отвечает прямо в треде —
// без claim/close/эскалации/приоритета/рейтингов и прочего жизненного
// цикла старой системы. Общие вопросы, апелляции, баги убраны целиком.
// См. CHANGELOG.
//
// categoryId — категория, где живут panelChannel/submissionsChannel.
// panelChannelId — публичный канал с кнопкой (видит любой участник,
// писать нельзя, только жать кнопку).
// submissionsChannelId — родитель для тредов жалоб (сам канал видит
// только staff; ManageThreads на нём даёт видеть и приватные треды
// внутри без явного добавления в каждый).
// supportRoleId — пинг в новом треде.
// counter — сквозной номер тикета для имени треда ("ticket-<N>").
// reports — [{ targetUserId, createdAt }], плоский лог жалоб на игроков
// для подсчёта "N жалоб за 30 дней" (см. model.js countRecentReportsOn)
// — не сами тикеты, просто список для статистики.
const DEFAULTS = {
    categoryId: null,
    panelChannelId: null,
    submissionsChannelId: null,
    supportRoleId: null,
    counter: 0,
    reports: [],
};

function normalize(data) {
    return {
        ...DEFAULTS,
        ...data,
        reports: [...(data.reports ?? [])],
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
