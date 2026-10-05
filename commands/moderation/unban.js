const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { COLORS, baseEmbed, formatBody, errorEmbed } = require('../../utils/embeds');
const moderation = require('../../moderation');

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

        // moderation.unbanMember(), а не interaction.guild.members.unban()
        // напрямую — снимает и запись о временном бане (moderation/model.js
        // tempBans), если она есть, иначе sweep.js потом попробовал бы
        // разбанить уже разбаненного вручную участника по истечении срока
        // (не ошибка сама по себе, но бессмысленный лишний вызов API).
        await moderation.unbanMember(interaction.guild, userId);

        const embed = baseEmbed(COLORS.success)
            .setDescription(formatBody('Пользователь разбанен'))
            .addFields(
                { name: 'ID пользователя', value: userId, inline: true },
                { name: 'Модератор', value: `${interaction.user}`, inline: true }
            );

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
