const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addWarning } = require('../../utils/warnings');
const { COLORS, baseEmbed, formatBody } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Выдать предупреждение участнику')
        .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Причина').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        const warnings = await addWarning(interaction.guild.id, target.id, reason, interaction.user.tag);

        const embed = baseEmbed(COLORS.warning)
            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
            .setDescription(formatBody('Предупреждение выдано'))
            .addFields(
                { name: 'Участник', value: `${target}`, inline: true },
                { name: 'Модератор', value: `${interaction.user}`, inline: true },
                { name: 'Причина', value: reason },
                { name: 'Всего предупреждений', value: `${warnings.length}`, inline: true }
            )
            .setFooter({ text: `ID: ${target.id}` });

        await interaction.reply({ embeds: [embed], ephemeral: true });

        const dmEmbed = baseEmbed(COLORS.warning)
            .setDescription(formatBody('Вы получили предупреждение'))
            .addFields(
                { name: 'Сервер', value: interaction.guild.name, inline: true },
                { name: 'Причина', value: reason }
            );

        await target.send({ embeds: [dmEmbed] }).catch(() => {});
    },
};
