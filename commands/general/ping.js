const { SlashCommandBuilder } = require('discord.js');
const { COLORS, baseEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder().setName('ping').setDescription('Проверить задержку бота'),

    async execute(interaction) {
        await interaction.reply({
            embeds: [baseEmbed(COLORS.primary).setTitle('Пинг').setDescription('Измеряю задержку...')],
            ephemeral: true,
        });

        const sent = await interaction.fetchReply();
        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;

        const embed = baseEmbed(COLORS.primary)
            .setTitle('Пинг')
            .addFields(
                { name: 'Round-trip', value: `${roundtrip} мс`, inline: true },
                { name: 'WebSocket', value: `${Math.round(interaction.client.ws.ping)} мс`, inline: true }
            );

        await interaction.editReply({ embeds: [embed] });
    },
};
