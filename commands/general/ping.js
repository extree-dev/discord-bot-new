const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { COLORS, baseEmbed, formatBody } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder().setName('ping').setDescription('Проверить задержку бота'),

    async execute(interaction) {
        await interaction.reply({
            embeds: [baseEmbed(COLORS.primary).setDescription(formatBody('Пинг', 'Измеряю задержку...'))],
            flags: MessageFlags.Ephemeral,
        });

        const sent = await interaction.fetchReply();
        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;

        const embed = baseEmbed(COLORS.primary)
            .setDescription(formatBody('Пинг'))
            .addFields(
                { name: 'Round-trip', value: `${roundtrip} мс`, inline: true },
                { name: 'WebSocket', value: `${Math.round(interaction.client.ws.ping)} мс`, inline: true }
            );

        await interaction.editReply({ embeds: [embed] });
    },
};
