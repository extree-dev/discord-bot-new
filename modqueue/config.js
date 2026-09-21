const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'modqueue';

// moderatedChannelIds — каналы, где сообщения участников уходят на
// проверку модератору вместо прямой публикации (см. modqueue/model.js);
// управляется командой /mod-queue add|remove, без редеплоя. reviewChannelId —
// канал для карточек на одобрение/отклонение, провижинится
// scripts/setup-modqueue.js.
const DEFAULTS = {
    moderatedChannelIds: [],
    reviewChannelId: null,
};

function normalize(data) {
    return {
        moderatedChannelIds: [...(data.moderatedChannelIds ?? [])],
        reviewChannelId: data.reviewChannelId ?? null,
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
