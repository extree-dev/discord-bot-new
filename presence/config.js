const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'presence';

// activity.type — числовое значение discord.js ActivityType (0 Playing,
// 1 Streaming, 2 Listening, 3 Watching, 5 Competing). Streaming
// дополнительно требует activity.url — ссылку на twitch.tv или
// youtube.com/watch, иначе Discord не рисует бейдж "В эфире" (см.
// presence/model.js isValidStreamUrl). rotateItems — [{ type, text, url }],
// крутятся по кругу, если rotate=true. rotateIndex/lastRotatedAt —
// состояние ротации, хранится в БД, а не в памяти процесса, чтобы не
// начинать её с нуля при каждом перезапуске бота.
const DEFAULTS = {
    status: 'online', // online | idle | dnd | invisible
    activity: { type: 0, text: null, url: null },
    rotate: false,
    rotateItems: [],
    rotateIntervalMs: 5 * 60 * 1000,
    rotateIndex: 0,
    lastRotatedAt: 0,
};

function normalize(data) {
    return {
        ...DEFAULTS,
        ...data,
        activity: { ...DEFAULTS.activity, ...data.activity },
        rotateItems: (data.rotateItems ?? []).map(item => ({ url: null, ...item })),
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
