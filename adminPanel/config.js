const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'admin-panel';

// channelId — staff-only канал с постоянной панелью-сообщением (кнопки
// вместо слэш-команд для самых частых админских действий), провижинится
// scripts/setup-admin-panel.js. categoryId — родительская категория канала
// (та же "🔐 Модерация", что у security-log).
const DEFAULTS = {
    channelId: null,
    categoryId: null,
};

function normalize(data) {
    return {
        channelId: data.channelId ?? null,
        categoryId: data.categoryId ?? null,
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
