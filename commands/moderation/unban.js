const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Разбанить пользователя по ID')
        .addStringOption(option =>
            option.setName('user_id').setDescription('ID пользователя').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const userId = interaction.options.getString('user_id');

        const bans = await interaction.guild.bans.fetch();
        if (!bans.has(userId)) {
            return interaction.reply({ embeds: [errorEmbed('Этот пользователь не забанен.')], ephemeral: true });
        }

        await interaction.guild.members.unban(userId);

        const embed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('Пользователь разбанен')
            .addFields(
                { name: 'ID пользователя', value: userId, inline: true },
                { name: 'Модератор', value: `${interaction.user}`, inline: true },
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
