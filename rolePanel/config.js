const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'rolePanel';

// channelId — канал с панелью выбора игровых ролей (создаёт scripts/
// setup-role-panel.js). roleIds — game.key (см. gameNews/games.js,
// общий список игр с новостными каналами) → ID роли — те же роли, что
// заводит адаптация (scripts/add-onboarding-role-questions.js), панель
// их не создаёт, только находит по имени при настройке. colorRoleIds —
// color.key (см. rolePanel/colors.js) → ID роли-цвета; в отличие от
// игровых ролей, эти роли панель создаёт сама (--bootstrap) — больше
// никто их не использует.
const DEFAULTS = {
    categoryId: null,
    channelId: null,
    roleIds: {},
    colorRoleIds: {},
};

function normalize(data) {
    return {
        ...DEFAULTS,
        ...data,
        roleIds: { ...DEFAULTS.roleIds, ...data.roleIds },
        colorRoleIds: { ...DEFAULTS.colorRoleIds, ...data.colorRoleIds },
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
