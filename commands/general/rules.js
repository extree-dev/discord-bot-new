const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const rules = require('../../rules');
const ideaQueue = require('../../ideaQueue');

module.exports = {
    data: new SlashCommandBuilder().setName('rules').setDescription('Показать правила сервера'),

    async execute(interaction) {
        const ideaConfig = await ideaQueue.getConfig();
        await interaction.reply({
            embeds: [rules.buildRulesEmbed(ideaConfig.channelId)],
            flags: MessageFlags.Ephemeral,
        });
    },
};
