const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'commands-channel';

const DEFAULTS = {
    channelId: null,
};

function normalize(data) {
    return { ...DEFAULTS, ...data };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, update: store.update };
