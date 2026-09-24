const config = require('./config');
const { GAMES } = require('./games');

// Публичный API фичи gameNews/. Пока только хранит ID категории и
// каналов, которые пинит scripts/setup-game-news.js — самой публикации
// новостей ещё нет, это будущая интеграция Steam API.
module.exports = {
    GAMES,
    getConfig: config.load,
    saveTargets: async ({ categoryId, channels }) => {
        await config.update(c => {
            c.categoryId = categoryId;
            c.channels = channels;
        });
    },
};
