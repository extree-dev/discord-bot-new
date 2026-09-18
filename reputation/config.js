const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'reputation';

// users — ключ "guildId_userId": score, givenTo (кому и когда этот
// пользователь давал реп — для проверки кулдауна на пару и дневного
// лимита), history (последние полученные репутации — для профиля).
// guilds — ключ guildId: announceChannelId (канал для еженедельного
// рейтинга и карточек level-up), levelRoles (индекс уровня из LEVELS →
// roleId, выдаётся автоматически при достижении), lastLeaderboardAt/
// lastSnapshot — состояние для показа изменения позиции в рейтинге.
const DEFAULTS = {
    users: {},
    guilds: {},
};

function normalize(data) {
    return {
        users: { ...(data.users ?? {}) },
        guilds: { ...(data.guilds ?? {}) },
    };
}

const store = createStore(STORE_NAME, DEFAULTS, normalize);

module.exports = { load: store.load, save: store.save, update: store.update, storeName: STORE_NAME };
