const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { COLORS, baseEmbed, formatBody, errorEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Разбанить пользователя по ID')
        .addStringOption(option => option.setName('user_id').setDescription('ID пользователя').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const userId = interaction.options.getString('user_id');

        const bans = await interaction.guild.bans.fetch();
        if (!bans.has(userId)) {
            return interaction.reply({
                embeds: [errorEmbed('Этот пользователь не забанен.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.guild.members.unban(userId);

        const embed = baseEmbed(COLORS.success)
            .setDescription(formatBody('Пользователь разбанен'))
            .addFields(
                { name: 'ID пользователя', value: userId, inline: true },
                { name: 'Модератор', value: `${interaction.user}`, inline: true }
            );

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
