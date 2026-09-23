const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'valorantEsports';

// Свой store для киберспорта (valorantNews/esports.js), отдельно от
// ленты новостей: свой канал, своя роль для пинга и своя память.
// channelId/pingRoleId — пинит scripts/setup-esports-news.js.
// seenArticleUrls — статьи категории esports, уже виденные ботом.
// liveMatchKeys/resultMatchKeys — матчи, о начале/итоге которых уже
// написали. null — ещё ни разу не проверяли: на первой проверке всё
// текущее запоминается без публикации, как и у ленты новостей.
// lastDigestDate — дата (по Москве) последней сводки "Матчи сегодня".
const DEFAULTS = {
    channelId: null,
    pingRoleId: null,
    seenArticleUrls: null,
    liveMatchKeys: null,
    resultMatchKeys: null,
    lastDigestDate: null,
};

const store = createStore(STORE_NAME, DEFAULTS);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
