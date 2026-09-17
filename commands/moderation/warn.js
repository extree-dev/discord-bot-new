const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addWarning } = require('../../utils/warnings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Выдать предупреждение участнику')
        .addUserOption(option =>
            option.setName('user').setDescription('Участник').setRequired(true))
        .addStringOption(option =>
            option.setName('reason').setDescription('Причина').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        const warnings = await addWarning(interaction.guild.id, target.id, reason, interaction.user.tag);

        const embed = new EmbedBuilder()
            .setColor(0xfee75c)
            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
            .setTitle('Предупреждение выдано')
            .addFields(
                { name: 'Участник', value: `${target}`, inline: true },
                { name: 'Модератор', value: `${interaction.user}`, inline: true },
                { name: 'Причина', value: reason },
                { name: 'Всего предупреждений', value: `${warnings.length}`, inline: true },
            )
            .setFooter({ text: `ID: ${target.id}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

        const dmEmbed = new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle('Вы получили предупреждение')
            .addFields(
                { name: 'Сервер', value: interaction.guild.name, inline: true },
                { name: 'Причина', value: reason },
            )
            .setTimestamp();

        await target.send({ embeds: [dmEmbed] }).catch(() => {});
    },
};
