const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'changelog';

// channelId — канал, куда бот публикует карточку "что нового" при
// первом запуске на новой версии. lastAnnouncedVersion — версия, для
// которой это уже сделано, чтобы не публиковать её повторно на каждый
// последующий рестарт.
const DEFAULTS = {
    channelId: null,
    lastAnnouncedVersion: null,
};

const store = createStore(STORE_NAME, DEFAULTS);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
