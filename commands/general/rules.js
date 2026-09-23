const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const rules = require('../../rules');

module.exports = {
    data: new SlashCommandBuilder().setName('rules').setDescription('Показать правила сервера'),

    async execute(interaction) {
        await interaction.reply({ embeds: [rules.buildRulesEmbed()], flags: MessageFlags.Ephemeral });
    },
};
