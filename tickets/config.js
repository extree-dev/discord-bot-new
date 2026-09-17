const path = require('path');
const { createStore } = require('../utils/jsonStore');

const filePath = path.join(__dirname, '..', 'data', 'tickets.json');

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

const store = createStore(filePath, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, filePath };
