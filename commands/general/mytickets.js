const { SlashCommandBuilder } = require('discord.js');
const tickets = require('../../tickets');
const { COLORS, baseEmbed, formatBody, infoEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder().setName('mytickets').setDescription('Показать мои обращения в поддержку'),

    async execute(interaction) {
        const config = await tickets.getConfig();
        const mine = Object.values(config.tickets)
            .filter(t => t.ownerId === interaction.user.id)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 10);

        if (!mine.length) {
            return interaction.reply({
                embeds: [infoEmbed('У тебя пока нет обращений в поддержку.', 'Мои тикеты')],
                ephemeral: true,
            });
        }

        const lines = mine.map(
            t =>
                `#${t.number} · ${t.reason} · ${tickets.STATUS_LABELS[t.status] ?? t.status}` +
                (typeof t.rating === 'number' ? ` · оценка: ${t.rating}/5` : '')
        );
        const embed = baseEmbed(COLORS.primary)
            .setDescription(formatBody('Мои тикеты', 'Последние 10 обращений'))
            .addFields({ name: 'Список', value: lines.join('\n').slice(0, 1024) });
        return interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
