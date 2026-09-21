const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'rules';

const DEFAULTS = {
    channelId: null,
    messageId: null,
    // Категория "📋 Информация" (общая с changelog/ и leveling/, но у
    // каждой фичи свой config-store) — нужна scripts/setup-rules.js, чтобы
    // не искать категорию по одному только имени при повторном деплое.
    categoryId: null,
};

const store = createStore(STORE_NAME, DEFAULTS);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
