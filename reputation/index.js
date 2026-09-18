const model = require('./model');

const LEADERBOARD_TICK_MS = 60 * 60 * 1000; // проверяем раз в час, публикуем — раз в неделю (см. model.js)

// Публичный API фичи reputation/. Команда /rep и scripts/setup-reputation.js
// обращаются только сюда, а не к reputation/model.js или reputation/config.js напрямую.
module.exports = {
    register: client => {
        setInterval(() => {
            model.checkAndPostLeaderboard(client).catch(err => console.error('reputation leaderboard:', err));
        }, LEADERBOARD_TICK_MS);
    },
    LEVELS: model.LEVELS,
    giveReputation: model.giveReputation,
    getProfile: model.getProfile,
    getLeaderboard: model.getLeaderboard,
    setReputation: model.setReputation,
    getLevelRoleId: model.getLevelRoleId,
    configureGuild: model.configureGuild,
    buildProfileCard: model.buildProfileCard,
    buildProfileAttachment: model.buildProfileAttachment,
    buildLevelUpCard: model.buildLevelUpCard,
    buildLeaderboardCard: model.buildLeaderboardCard,
    buildLeaderboardMovement: model.buildLeaderboardMovement,
};
