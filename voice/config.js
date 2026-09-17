const path = require('path');
const { createStore } = require('../utils/jsonStore');

const filePath = path.join(__dirname, '..', 'data', 'temp-voice.json');

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

const store = createStore(filePath, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, filePath };
