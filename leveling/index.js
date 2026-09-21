const model = require('./model');
const handlers = require('./handlers');
const sweep = require('./sweep');

const LEADERBOARD_TICK_MS = 60 * 60 * 1000; // проверяем раз в час, публикуем — раз в неделю (см. model.js)

// Публичный API фичи leveling/. Команда /level и scripts/setup-leveling.js
// (а также security/verification.js — за стартовой ролью уровня)
// обращаются только сюда, а не к leveling/model.js напрямую.
module.exports = {
    register: client => {
        handlers.register(client);
        sweep.start(client);
        setInterval(() => {
            model.checkAndPostLeaderboard(client).catch(err => console.error('leveling leaderboard:', err));
        }, LEADERBOARD_TICK_MS);
    },
    LEVELS: model.LEVELS,
    getProfile: model.getProfile,
    getLeaderboard: model.getLeaderboard,
    setScore: model.setScore,
    getLevelRoleId: model.getLevelRoleId,
    grantLevelRolesUpTo: model.grantLevelRolesUpTo,
    getGuildConfig: model.getGuildConfig,
    configureGuild: model.configureGuild,
    getBoosterBundlePermissions: model.getBoosterBundlePermissions,
    buildRankCardAttachment: model.buildRankCardAttachment,
    buildLevelUpCard: model.buildLevelUpCard,
    buildLeaderboardAttachment: model.buildLeaderboardAttachment,
    buildLeaderboardMovement: model.buildLeaderboardMovement,
};
