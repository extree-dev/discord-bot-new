const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { COLORS, baseEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Удалить сообщения из канала')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Количество сообщений (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option =>
            option.setName('user').setDescription('Удалить только сообщения этого участника').setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const user = interaction.options.getUser('user');

        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const filtered = user ? messages.filter(m => m.author.id === user.id).first(amount) : messages.first(amount);

        const deleted = await interaction.channel.bulkDelete(filtered, true);

        const embed = baseEmbed(COLORS.primary)
            .setTitle('Сообщения удалены')
            .addFields(
                { name: 'Количество', value: `${deleted.size}`, inline: true },
                { name: 'Модератор', value: `${interaction.user}`, inline: true }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
