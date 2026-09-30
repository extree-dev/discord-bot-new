const config = require('./config');
const { GAMES, newsRoleName } = require('./games');

// Публичный API фичи gameNews/. Пока только хранит ID категории,
// каналов и ролей-пингов новостей, которые создаёт scripts/setup-game-
// news.js — самой публикации новостей ещё нет, это будущая интеграция
// Steam API (она же будет назначать роли-пинги — панель самостоятельного
// выбора этих ролей убрана по прямому запросу администратора).
module.exports = {
    GAMES,
    newsRoleName,
    getConfig: config.load,
    saveTargets: async ({ categoryId, channels, newsRoleIds }) => {
        await config.update(c => {
            c.categoryId = categoryId;
            c.channels = channels;
            c.newsRoleIds = newsRoleIds;
        });
    },
};
