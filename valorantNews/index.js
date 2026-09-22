const config = require('./config');
const model = require('./model');

// Проверяем не чаще, чем раз в 30 минут — патчи и новости выходят редко,
// а Basic-ключ HenrikDev ограничен 30 запросами/мин, так что даже частый
// перезапуск бота не рискует упереться в лимит.
const POLL_INTERVAL_MS = 30 * 60 * 1000;

// Публичный API фичи valorantNews/. scripts/setup-valorant-news.js
// обращается только сюда, а не к valorantNews/config.js напрямую.
module.exports = {
    register: client => {
        model.checkAndPostNews(client).catch(err => console.error('valorantNews:', err));
        setInterval(() => {
            model.checkAndPostNews(client).catch(err => console.error('valorantNews:', err));
        }, POLL_INTERVAL_MS);
    },
    getConfig: config.load,
    saveChannel: async channelId => {
        await config.update(c => {
            c.channelId = channelId;
        });
    },
};
