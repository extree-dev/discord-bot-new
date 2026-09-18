const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { COLORS, baseEmbed, formatBody, errorEmbed, successEmbed } = require('../../utils/embeds');
const security = require('../../security');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Отправить сообщение от имени бота в канал')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Канал')
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement,
                    ChannelType.PublicThread,
                    ChannelType.PrivateThread
                )
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('text').setDescription('Текст сообщения').setMaxLength(2000).setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const text = interaction.options.getString('text');

        const permissions = channel.permissionsFor(interaction.guild.members.me);
        if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({
                embeds: [errorEmbed('У меня нет прав писать в этот канал.')],
                ephemeral: true,
            });
        }

        try {
            await channel.send({ content: text });
        } catch (err) {
            return interaction.reply({
                embeds: [errorEmbed(`Не удалось отправить сообщение: ${err.message}`)],
                ephemeral: true,
            });
        }

        await interaction.reply({
            embeds: [successEmbed(`Сообщение отправлено в ${channel}.`)],
            ephemeral: true,
        });

        // Discord не пишет в свой audit log отдельные сообщения бота — без
        // этой ручной записи в security-log было бы невозможно узнать, кто
        // из администраторов и что отправил от имени бота.
        await security.log(
            interaction.guild,
            baseEmbed(COLORS.neutral)
                .setDescription(formatBody('Сообщение от имени бота (/say)'))
                .addFields(
                    { name: 'Администратор', value: `${interaction.user}`, inline: true },
                    { name: 'Канал', value: `${channel}`, inline: true },
                    { name: 'Текст', value: text.slice(0, 1000) }
                )
        );
    },
};
