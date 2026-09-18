const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'temp-voice';

const DEFAULTS = {
    triggerChannelId: null,
    categoryId: null,
    // Отдельная категория для самих временных комнат — categoryId держит
    // только триггер-канал и панель управления, чтобы она не зарастала
    // десятками комнат участников (см. voice/model.js createRoom()).
    roomsCategoryId: null,
    controlChannelId: null,
    defaultLimit: 5,
    channels: {},
};

function normalize(data) {
    return { ...DEFAULTS, ...data, channels: { ...data.channels } };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
