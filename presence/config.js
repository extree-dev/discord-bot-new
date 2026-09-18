const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'presence';

// activity.type — числовое значение discord.js ActivityType (0 Playing,
// 2 Listening, 3 Watching, 5 Competing; 1 Streaming не поддерживаем —
// требует url). rotateItems — [{ type, text }], крутятся по кругу, если
// rotate=true. rotateIndex/lastRotatedAt — состояние ротации, хранится
// в БД, а не в памяти процесса, чтобы не начинать её с нуля при каждом
// перезапуске бота.
const DEFAULTS = {
    status: 'online', // online | idle | dnd | invisible
    activity: { type: 0, text: null },
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
        rotateItems: [...(data.rotateItems ?? [])],
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
