const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'leveling';

// users — ключ "guildId_userId": score (очки активности — сообщения +
// голос, см. model.js), messageCount/voiceMinutes — сырые счётчики для
// отображения на карточке профиля отдельно от итогового score.
// guilds — ключ guildId: announceChannelId (канал для еженедельного
// топа и карточек level-up), categoryId, levelRoles (индекс яруса из
// LEVELS → roleId, выдаётся автоматически при достижении),
// lastLeaderboardAt/lastSnapshot — состояние для показа изменения
// позиции в топе, clubCategoryId/fighterVoiceChannelId/
// masterTextChannelId/masterVoiceChannelId — клубные каналы ярусов
// "Боец"/"Мастер" (см. scripts/setup-leveling.js).
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
