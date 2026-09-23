const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'valorantNews';

// channelId — свой независимый config-store (тот же принцип, что у
// changelog/rules/leveling — см. FSD-границы фич в README): свой канал
// #📬│game-news, не связанный с changelog/ (scripts/setup-valorant-news.js
// пинит его ID напрямую, без обращения к changelog/config.js).
// seenArticleUrls — url статей, которые бот уже видел в ленте
// (опубликованных или нет — на самом первом прогоне бэклог не
// публикуется, см. valorantNews/model.js), чтобы не слать одно и то же
// повторно и не заспамить канал всей историей новостей при первом запуске.
// null — ещё ни разу не проверяли.
const DEFAULTS = {
    channelId: null,
    seenArticleUrls: null,
};

const store = createStore(STORE_NAME, DEFAULTS);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
