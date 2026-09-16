const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Замутить участника на время (0 - снять мут)')
        .addUserOption(option =>
            option.setName('user').setDescription('Участник').setRequired(true))
        .addIntegerOption(option =>
            option.setName('minutes').setDescription('Длительность в минутах (0 = снять мут)').setRequired(true).setMinValue(0).setMaxValue(40320))
        .addStringOption(option =>
            option.setName('reason').setDescription('Причина').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const minutes = interaction.options.getInteger('minutes');
        const reason = interaction.options.getString('reason') ?? 'Причина не указана';
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) {
            return interaction.reply({ embeds: [errorEmbed('Не удалось найти этого участника на сервере.')], ephemeral: true });
        }
        if (!member.moderatable) {
            return interaction.reply({
                embeds: [errorEmbed('Я не могу замутить этого участника (недостаточно прав или роль выше моей).')],
                ephemeral: true,
            });
        }

        if (minutes === 0) {
            await member.timeout(null, reason);
            const unmuteEmbed = new EmbedBuilder()
                .setColor(0x57f287)
                .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
                .setTitle('Мут снят')
                .addFields(
                    { name: 'Участник', value: `${target}`, inline: true },
                    { name: 'Модератор', value: `${interaction.user}`, inline: true },
                )
                .setTimestamp();
            return interaction.reply({ embeds: [unmuteEmbed], ephemeral: true });
        }

        await member.timeout(minutes * 60 * 1000, reason);

        const embed = new EmbedBuilder()
            .setColor(0xfee75c)
            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
            .setTitle('Участник замучен')
            .addFields(
                { name: 'Участник', value: `${target}`, inline: true },
                { name: 'Модератор', value: `${interaction.user}`, inline: true },
                { name: 'Длительность', value: `${minutes} мин.`, inline: true },
                { name: 'Причина', value: reason },
            )
            .setFooter({ text: `ID: ${target.id}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
