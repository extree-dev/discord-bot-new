const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'tickets';

const DEFAULTS = {
    categoryId: null,
    panelChannelId: null,
    logChannelId: null,
    supportRoleId: null,
    counter: 0,
    tickets: {},
};

function normalize(data) {
    return { ...DEFAULTS, ...data, tickets: { ...data.tickets } };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
