const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Забанить участника на сервере')
        .addUserOption(option =>
            option.setName('user').setDescription('Участник').setRequired(true))
        .addStringOption(option =>
            option.setName('reason').setDescription('Причина').setRequired(false))
        .addIntegerOption(option =>
            option.setName('delete_days').setDescription('Удалить сообщения за N дней (0-7)').setMinValue(0).setMaxValue(7))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') ?? 'Причина не указана';
        const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (member && !member.bannable) {
            return interaction.reply({
                embeds: [errorEmbed('Я не могу забанить этого участника (недостаточно прав или роль выше моей).')],
                ephemeral: true,
            });
        }

        await interaction.guild.members.ban(target.id, {
            deleteMessageSeconds: deleteDays * 24 * 60 * 60,
            reason,
        });

        const embed = new EmbedBuilder()
            .setColor(0xed4245)
            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
            .setTitle('Участник забанен')
            .addFields(
                { name: 'Участник', value: `${target}`, inline: true },
                { name: 'Модератор', value: `${interaction.user}`, inline: true },
                { name: 'Причина', value: reason },
            )
            .setFooter({ text: `ID: ${target.id}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
