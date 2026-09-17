const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'temp-voice';

const DEFAULTS = {
    triggerChannelId: null,
    categoryId: null,
    controlChannelId: null,
    defaultLimit: 5,
    channels: {},
};

function normalize(data) {
    return { ...DEFAULTS, ...data, channels: { ...data.channels } };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
