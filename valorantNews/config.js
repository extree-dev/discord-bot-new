const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'valorantNews';

// channelId — свой независимый config-store (тот же принцип, что у
// changelog/rules/leveling — см. FSD-границы фич в README), даже хотя
// физически сейчас это тот же канал #📰│новости-сервера, что и у
// changelog/ (scripts/setup-valorant-news.js синхронизирует значение
// оттуда, а не читает changelog/config.js напрямую при каждой публикации).
// lastArticleDate — ISO-дата самой свежей статьи, которую скрипт уже
// видел (опубликованной или нет — на самом первом прогоне бэклог не
// публикуется, см. valorantNews/model.js), чтобы не слать одно и то же
// повторно и не заспамить канал всей историей новостей при первом запуске.
const DEFAULTS = {
    channelId: null,
    lastArticleDate: null,
};

const store = createStore(STORE_NAME, DEFAULTS);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
