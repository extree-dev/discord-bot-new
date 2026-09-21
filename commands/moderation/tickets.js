const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const tickets = require('../../tickets');
const { COLORS, baseEmbed, formatBody, errorEmbed, successEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Управление системой тикетов (для поддержки)')
        // Раньше тут не было этого вызова — команда была видна и обычным
        // участникам в списке слэш-команд (execute() блокировал их только
        // после выбора), что не согласуется с остальными staff-командами
        // (dashboard, warn, timeout и т.д. скрыты этим же флагом).
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
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
        )
        .addSubcommand(sub =>
            sub
                .setName('close')
                .setDescription('Закрыть текущий тикет — запасной путь, если карточка с кнопками не отправилась')
        )
        .addSubcommand(sub =>
            sub
                .setName('cooldown-reset')
                .setDescription('Снять антиспам-кулдаун на открытие тикета для участника')
                .addUserOption(opt => opt.setName('user').setDescription('Участник').setRequired(true))
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
                // Срочные тикеты — в начале списка, чтобы staff видел их
                // первыми, а не искал среди обычных вопросов.
                .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.createdAt - b.createdAt)
                .map(
                    t =>
                        `${t.urgent ? '[Срочно] ' : ''}#${t.number} · ${tickets.STATUS_LABELS[t.status] ?? t.status} · <@${t.ownerId}> · ` +
                        `${t.claimedBy ? `взял <@${t.claimedBy}>` : 'не взят'} · открыт ${tickets.formatDuration(Date.now() - t.createdAt)} назад`
                );
            const embed = baseEmbed(COLORS.primary)
                .setDescription(formatBody('Открытые тикеты'))
                .addFields({ name: 'Список', value: lines.join('\n').slice(0, 1024) });
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'stats') {
            const { perStaff, averageFirstResponseMs } = tickets.aggregateStats(config);
            const staffEntries = Object.entries(perStaff);
            if (!staffEntries.length) {
                return interaction.reply({
                    embeds: [successEmbed('Пока нет закрытых тикетов.', 'Статистика')],
                    ephemeral: true,
                });
            }
            const lines = staffEntries
                .sort(([, a], [, b]) => b.closed - a.closed)
                .map(([staffId, s]) => {
                    const resolveTime = s.closed
                        ? `, среднее время решения: ${tickets.formatDuration(s.totalResolveMs / s.closed)}`
                        : '';
                    return `<@${staffId}> — закрыл: ${s.closed}${resolveTime}`;
                });
            const embed = baseEmbed(COLORS.primary)
                .setDescription(formatBody('Статистика поддержки'))
                .addFields(
                    { name: 'По сотрудникам', value: lines.join('\n').slice(0, 1024) },
                    {
                        name: 'Среднее время первого ответа',
                        value: averageFirstResponseMs ? tickets.formatDuration(averageFirstResponseMs) : 'нет данных',
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

        if (sub === 'close') {
            // Запасной путь на случай, если карточка тикета (кнопка
            // "Закрыть") по какой-то причине не отправилась (например,
            // сбой сети Discord при создании — см. фикс 3.9.9) — команда
            // ищет тикет не по номеру, а по текущему каналу, как
            // /ticket reply и note.
            const entry = config.tickets[interaction.channelId];
            if (!entry) {
                // Беспризорный тред: похож на тикет (открыт в приватном
                // треде канала тикетов), но записи о нём в сторе уже нет
                // — например, ранняя версия этого же фикса (3.9.10)
                // откатывала запись при сбое отправки карточки, а сам
                // тред при этом мог не удалиться (тот же нестабильный
                // Discord API). Раз связать его ни с чем нельзя, просто
                // архивируем тред напрямую — иначе закрыть его вообще
                // нечем, а числиться открытым тикетом (и блокировать
                // автору создание нового) он и так уже не может.
                if (interaction.channel.isThread()) {
                    await interaction.deferReply({ ephemeral: true });
                    await interaction.channel
                        .setLocked(true, 'Беспризорный тред тикета закрыт вручную')
                        .catch(() => {});
                    await interaction.channel
                        .setArchived(true, 'Беспризорный тред тикета закрыт вручную')
                        .catch(() => {});
                    return interaction.editReply({
                        embeds: [
                            successEmbed(
                                'Записи об этом тикете в базе уже не было (беспризорный тред) — тред просто заархивирован.',
                                'Готово'
                            ),
                        ],
                    });
                }
                return interaction.reply({
                    embeds: [errorEmbed('Эту команду нужно использовать внутри тикета.')],
                    ephemeral: true,
                });
            }
            if (entry.status === tickets.STATUS.RESOLVED) {
                return interaction.reply({ embeds: [errorEmbed('Тикет уже закрыт.')], ephemeral: true });
            }
            // Та же логика, что и у кнопки "Закрыть": стажёр не закрывает
            // сразу, а запрашивает подтверждение старшего состава.
            if (tickets.isTrialStaff(config, interaction.member)) {
                await interaction.deferReply({ ephemeral: true });
                const result = await tickets.requestTicketClosure(
                    interaction.guild,
                    interaction.channel,
                    entry,
                    interaction.user.id
                );
                return interaction.editReply(
                    result.reviewChannel
                        ? 'Запрос на закрытие отправлен старшему составу на подтверждение.'
                        : 'Запрос сохранён, но канал подтверждения не настроен — сообщите администратору.'
                );
            }
            await interaction.deferReply({ ephemeral: true });
            await tickets.closeTicket(interaction.guild, interaction.channel, entry, interaction.user.id);
            return interaction.editReply({ embeds: [successEmbed('Тикет закрыт.', 'Готово')] });
        }

        if (sub === 'cooldown-reset') {
            const target = interaction.options.getUser('user');
            await tickets.resetTicketCooldown(target.id);
            return interaction.reply({
                embeds: [successEmbed(`Кулдаун на открытие тикета снят для ${target}.`, 'Готово')],
                ephemeral: true,
            });
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
