const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'ideaQueue';

// Очередь предложений по конкретному каналу — не общая модерация
// сообщений (для этого есть modqueue/), а отдельная витрина идей на один
// заранее известный администратору канал. channelId/reviewChannelId
// провижинятся один раз по фиксированному ID (см. scripts/setup-idea-
// queue.js, тот же приём, что managementCategoryId у тикетов) — команды
// на добавление/удаление каналов нет, канал один и не меняется на лету.
const DEFAULTS = {
    channelId: null,
    reviewChannelId: null,
};

function normalize(data) {
    return {
        channelId: data.channelId ?? null,
        reviewChannelId: data.reviewChannelId ?? null,
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
