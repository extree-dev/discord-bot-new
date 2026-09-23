const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { COLORS, baseEmbed, formatBody, errorEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Установить режим замедления в канале')
        .addIntegerOption(option =>
            option
                .setName('seconds')
                .setDescription('Секунды между сообщениями (0 — выключить)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)
        )
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Канал (по умолчанию — текущий)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const seconds = interaction.options.getInteger('seconds');
        const channel = interaction.options.getChannel('channel') ?? interaction.channel;

        if (!channel.isTextBased() || channel.isThread()) {
            return interaction.reply({
                embeds: [errorEmbed('Slowmode можно установить только в текстовом канале.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        await channel.setRateLimitPerUser(seconds, `Slowmode изменён: ${interaction.user.tag}`);

        const embed = baseEmbed(seconds === 0 ? COLORS.success : COLORS.primary)
            .setDescription(formatBody(seconds === 0 ? 'Slowmode выключен' : 'Slowmode установлен'))
            .addFields(
                { name: 'Канал', value: `${channel}`, inline: true },
                { name: 'Задержка', value: seconds === 0 ? 'выключена' : `${seconds} сек.`, inline: true }
            );

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
