const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'tickets';

// Система тикетов больше не заводит треды/жизненный цикл (claim/close/
// эскалация/рейтинги/транскрипты, испытательный срок для стажёров) — по
// решению администратора она заменена на простую форму, как на референс-
// сервере: кнопка → модалка → карточка сразу падает в канал стафу, без
// дальнейшего движения. См. CHANGELOG.
//
// categoryId — категория, где живут все 4 канала фичи ниже.
// panelChannelId/bugPanelChannelId — публичные каналы с кнопками (видит
// любой участник, писать в них нельзя, только жать кнопки).
// submissionsChannelId — куда падают карточки жалоб/апелляций/вопросов/
// "другого" (видит только staff).
// bugChannelId — куда падают карточки багов (видит только роль
// разработчика + staff) — Support на баги не пингуется, это и была цель
// разделения раньше, осталась и сейчас.
// supportRoleId — пинг на обычные обращения (кроме bug).
// reasonRoleIds — доп. пинг по теме (REASONS[].value → roleId).
// reports — [{ targetUserId, createdAt }], плоский лог жалоб на игроков
// для подсчёта "N жалоб за 30 дней" в карточке (см. model.js
// countRecentReportsOn) — не тикеты, просто список для статистики.
const DEFAULTS = {
    categoryId: null,
    panelChannelId: null,
    bugPanelChannelId: null,
    submissionsChannelId: null,
    bugChannelId: null,
    supportRoleId: null,
    reasonRoleIds: {},
    reports: [],
};

function normalize(data) {
    return {
        ...DEFAULTS,
        ...data,
        reasonRoleIds: { ...DEFAULTS.reasonRoleIds, ...data.reasonRoleIds },
        reports: [...(data.reports ?? [])],
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
