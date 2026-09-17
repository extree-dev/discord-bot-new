const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'rules';

const DEFAULTS = {
    channelId: null,
    messageId: null,
};

const store = createStore(STORE_NAME, DEFAULTS);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
