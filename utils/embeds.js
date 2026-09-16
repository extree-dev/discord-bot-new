const { EmbedBuilder } = require('discord.js');

function errorEmbed(description) {
    return new EmbedBuilder().setColor(0xed4245).setTitle('Ошибка').setDescription(description);
}

module.exports = { errorEmbed };
