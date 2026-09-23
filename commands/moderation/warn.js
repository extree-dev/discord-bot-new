const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { addWarning } = require('../../utils/warnings');
const { COLORS, baseEmbed, formatBody } = require('../../utils/embeds');
const { notifyPunishment } = require('../../utils/punishmentNotice');

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

        // Личные сообщения бот больше не шлёт вообще (по решению
        // администратора) — вместо этого приватный тред-уведомление
        // (utils/punishmentNotice.js), чтобы участник знал, за что
        // получил предупреждение.
        await notifyPunishment(target, interaction.guild, { kind: 'warn', reason });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
