const model = require('./model');
const config = require('./config');
const { GAMES } = require('../gameNews/games');
const { PALETTE } = require('./colors');

async function handleSelectMenu(interaction) {
    if (interaction.customId === model.GAMES_SELECT_CUSTOM_ID) {
        const cfg = await config.load();
        await model.handleGamesSelect(interaction, cfg.roleIds, GAMES);
        return true;
    }
    if (interaction.customId === model.COLOR_SELECT_CUSTOM_ID) {
        const cfg = await config.load();
        await model.handleColorSelect(interaction, cfg.colorRoleIds, PALETTE);
        return true;
    }
    return false;
}

module.exports = { handleSelectMenu };
