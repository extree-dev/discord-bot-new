const { SlashCommandBuilder } = require('discord.js');
const rules = require('../../rules');
const ideaQueue = require('../../ideaQueue');
const { toEphemeralMessage } = require('../../utils/components');

module.exports = {
    data: new SlashCommandBuilder().setName('rules').setDescription('Показать правила сервера'),

    async execute(interaction) {
        const ideaConfig = await ideaQueue.getConfig();
        const { components } = rules.buildRulesMessage(ideaConfig.channelId);
        await interaction.reply(toEphemeralMessage(...components));
    },
};
