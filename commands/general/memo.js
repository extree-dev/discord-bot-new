const { SlashCommandBuilder } = require('discord.js');
const memo = require('../../memo');
const { withEphemeral } = require('../../utils/components');

module.exports = {
    data: new SlashCommandBuilder().setName('memo').setDescription('Показать памятку по серверу'),

    async execute(interaction) {
        const ids = await memo.gatherChannelIds(interaction.guild.id);
        await interaction.reply(withEphemeral(memo.buildMemoMessage(ids)));
    },
};
