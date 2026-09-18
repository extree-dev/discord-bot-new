const { SlashCommandBuilder } = require('discord.js');
const tickets = require('../../tickets');
const { COLORS, baseEmbed, formatBody, errorEmbed, successEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Управление системой тикетов (для поддержки)')
        .addSubcommand(sub => sub.setName('list').setDescription('Список открытых тикетов'))
        .addSubcommand(sub => sub.setName('stats').setDescription('Статистика поддержки'))
        .addSubcommand(sub =>
            sub
                .setName('reply')
                .setDescription('Отправить готовый ответ в текущий тикет')
                .addStringOption(opt =>
                    opt
                        .setName('template')
                        .setDescription('Шаблон ответа')
                        .setRequired(true)
                        .addChoices(
                            ...Object.entries(tickets.CANNED_RESPONSES).map(([value, r]) => ({
                                name: r.label,
                                value,
                            }))
                        )
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('reopen')
                .setDescription('Переоткрыть закрытый тикет по номеру')
                .addIntegerOption(opt => opt.setName('number').setDescription('Номер тикета').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const config = await tickets.getConfig();
        if (!tickets.isStaff(config, interaction.member)) {
            return interaction.reply({
                embeds: [errorEmbed('Эта команда доступна только поддержке.')],
                ephemeral: true,
            });
        }

        if (sub === 'list') {
            const open = Object.values(config.tickets).filter(t => t.status !== tickets.STATUS.RESOLVED);
            if (!open.length) {
                return interaction.reply({
                    embeds: [successEmbed('Открытых тикетов нет.', 'Список тикетов')],
                    ephemeral: true,
                });
            }
            const lines = open
                .sort((a, b) => a.createdAt - b.createdAt)
                .map(
                    t =>
                        `#${t.number} · ${tickets.STATUS_LABELS[t.status] ?? t.status} · <@${t.ownerId}> · ` +
                        `${t.claimedBy ? `взял <@${t.claimedBy}>` : 'не взят'} · открыт ${tickets.formatDuration(Date.now() - t.createdAt)} назад`
                );
            const embed = baseEmbed(COLORS.primary)
                .setDescription(formatBody('Открытые тикеты'))
                .addFields({ name: 'Список', value: lines.join('\n').slice(0, 1024) });
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'stats') {
            const { perStaff, averageRating, ratedCount } = tickets.aggregateStats(config);
            const staffEntries = Object.entries(perStaff);
            if (!staffEntries.length) {
                return interaction.reply({
                    embeds: [successEmbed('Пока нет закрытых тикетов.', 'Статистика')],
                    ephemeral: true,
                });
            }
            const lines = staffEntries
                .sort(([, a], [, b]) => b.closed - a.closed)
                .map(
                    ([staffId, s]) =>
                        `<@${staffId}> — закрыл: ${s.closed}, среднее время решения: ${tickets.formatDuration(s.totalResolveMs / s.closed)}`
                );
            const embed = baseEmbed(COLORS.primary)
                .setDescription(formatBody('Статистика поддержки'))
                .addFields(
                    { name: 'По сотрудникам', value: lines.join('\n').slice(0, 1024) },
                    {
                        name: 'Средняя оценка',
                        value: averageRating ? `${averageRating.toFixed(1)} / 5 (${ratedCount} оценок)` : 'нет оценок',
                    }
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'reply') {
            if (!config.tickets[interaction.channelId]) {
                return interaction.reply({
                    embeds: [errorEmbed('Эту команду нужно использовать внутри тикета.')],
                    ephemeral: true,
                });
            }
            const key = interaction.options.getString('template');
            const result = await tickets.postCannedResponse(interaction, key);
            if (result.error) {
                return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
            }
            return interaction.reply({ embeds: [successEmbed('Ответ отправлен.', 'Готово')], ephemeral: true });
        }

        const number = interaction.options.getInteger('number');
        const result = await tickets.reopenTicket(interaction.guild, number);
        if (result.error) {
            return interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
        }
        return interaction.reply({
            embeds: [successEmbed(`Тикет #${number} переоткрыт: ${result.thread}`, 'Переоткрыт')],
            ephemeral: true,
        });
    },
};
