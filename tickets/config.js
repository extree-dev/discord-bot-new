const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'tickets';

// Система тикетов сужена до одной формы — жалоба на игрока (по прямому
// референсу администратора: кнопка → модалка с двумя текстовыми полями
// "тег/ID" и "описание" → карточка падает в канал стафу). Общие вопросы,
// апелляции, баги и весь жизненный цикл (треды/claim/эскалация/рейтинги)
// убраны целиком. См. CHANGELOG.
//
// categoryId — категория, где живут panelChannel/submissionsChannel.
// panelChannelId — публичный канал с кнопкой (видит любой участник,
// писать нельзя, только жать кнопку).
// submissionsChannelId — куда падают карточки жалоб (видит только staff).
// supportRoleId — пинг на новую карточку.
// reports — [{ targetUserId, createdAt }], плоский лог жалоб на игроков
// для подсчёта "N жалоб за 30 дней" в карточке (см. model.js
// countRecentReportsOn) — не тикеты, просто список для статистики.
const DEFAULTS = {
    categoryId: null,
    panelChannelId: null,
    submissionsChannelId: null,
    supportRoleId: null,
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
