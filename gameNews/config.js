const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'gameNews';

// categoryId — категория "🎮 Новости игр" (создаёт scripts/setup-game-
// news.js --bootstrap). channels — game.key (см. gameNews/games.js) →
// ID канала. Пока каналы пустые (по прямому запросу администратора) —
// публикацию туда подключит будущая интеграция Steam API. newsRoleIds —
// game.key → ID отдельной декоративной роли-пинга "Новости: <Game>"
// (тоже создаёт scripts/setup-game-news.js) — самостоятельно выбирается
// в rolePanel/, будущая интеграция Steam API будет упоминать её в
// публикации, чтобы пинговать только тех, кому интересна конкретная игра.
const DEFAULTS = {
    categoryId: null,
    channels: {},
    newsRoleIds: {},
};

function normalize(data) {
    return {
        ...DEFAULTS,
        ...data,
        channels: { ...DEFAULTS.channels, ...data.channels },
        newsRoleIds: { ...DEFAULTS.newsRoleIds, ...data.newsRoleIds },
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
