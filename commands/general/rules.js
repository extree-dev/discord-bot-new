const { SlashCommandBuilder } = require('discord.js');
const rules = require('../../rules');
const ideaQueue = require('../../ideaQueue');
const { withEphemeral } = require('../../utils/components');

module.exports = {
    data: new SlashCommandBuilder().setName('rules').setDescription('Показать правила сервера'),

    async execute(interaction) {
        const ideaConfig = await ideaQueue.getConfig();
        await interaction.reply(withEphemeral(rules.buildRulesMessage(ideaConfig.channelId)));
    },
};
