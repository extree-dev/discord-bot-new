const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'gameNews';

// categoryId — категория "🎮 Новости игр" (создаёт scripts/setup-game-
// news.js --bootstrap). channels — game.key (см. gameNews/games.js) →
// ID канала. Пока каналы пустые (по прямому запросу администратора) —
// публикацию туда подключит будущая интеграция Steam API.
const DEFAULTS = {
    categoryId: null,
    channels: {},
};

function normalize(data) {
    return { ...DEFAULTS, ...data, channels: { ...DEFAULTS.channels, ...data.channels } };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
