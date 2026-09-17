const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'suggestions';

const DEFAULTS = {
    panelChannelId: null,
    outputChannelId: null,
    counter: 0,
};

const store = createStore(STORE_NAME, DEFAULTS);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
