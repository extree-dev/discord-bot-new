const model = require('./model');
const config = require('./config');
const { GAMES } = require('../gameNews/games');

async function handleSelectMenu(interaction) {
    if (interaction.customId !== model.SELECT_CUSTOM_ID) return false;
    const cfg = await config.load();
    await model.handleGamesSelect(interaction, cfg.roleIds, GAMES);
    return true;
}

module.exports = { handleSelectMenu };
