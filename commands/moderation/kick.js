const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { COLORS, baseEmbed, formatBody, errorEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Кикнуть участника с сервера')
        .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Причина').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') ?? 'Причина не указана';
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) {
            return interaction.reply({
                embeds: [errorEmbed('Не удалось найти этого участника на сервере.')],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (!member.kickable) {
            return interaction.reply({
                embeds: [errorEmbed('Я не могу кикнуть этого участника (недостаточно прав или роль выше моей).')],
                flags: MessageFlags.Ephemeral,
            });
        }

        await member.kick(reason);

        const embed = baseEmbed(COLORS.danger)
            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
            .setDescription(formatBody('Участник кикнут'))
            .addFields(
                { name: 'Участник', value: `${target}`, inline: true },
                { name: 'Модератор', value: `${interaction.user}`, inline: true },
                { name: 'Причина', value: reason }
            )
            .setFooter({ text: `ID: ${target.id}` });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
