const config = require('./config');
const { GAMES, newsRoleName } = require('./games');

// Публичный API фичи gameNews/. Пока только хранит ID категории,
// каналов и ролей-пингов новостей, которые пинит scripts/setup-game-
// news.js — самой публикации новостей ещё нет, это будущая интеграция
// Steam API. Роли-пинги выбираются в rolePanel/, поэтому оттуда тоже
// читают getConfig() (единый источник — без дублирования newsRoleIds
// в конфиге rolePanel).
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
