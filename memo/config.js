const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'memo';

const DEFAULTS = {
    channelId: null,
    messageId: null,
    // Категория "📋 Информация" (общая с rules/changelog/leveling/, но у
    // каждой фичи свой config-store) — нужна scripts/setup-memo.js, чтобы
    // не искать категорию по одному только имени при повторном деплое.
    categoryId: null,
};

const store = createStore(STORE_NAME, DEFAULTS);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
