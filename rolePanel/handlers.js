const model = require('./model');
const config = require('./config');
const gameNews = require('../gameNews');
const { GAMES } = require('../gameNews/games');

async function handleSelectMenu(interaction) {
    if (interaction.customId === model.GAMES_SELECT_CUSTOM_ID) {
        const cfg = await config.load();
        await model.handleGamesSelect(interaction, cfg.roleIds, GAMES);
        return true;
    }
    if (interaction.customId === model.NEWS_SELECT_CUSTOM_ID) {
        const newsCfg = await gameNews.getConfig();
        await model.handleNewsSelect(interaction, newsCfg.newsRoleIds, GAMES);
        return true;
    }
    return false;
}

module.exports = { handleSelectMenu };
