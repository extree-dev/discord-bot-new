const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const security = require('../../security');
const { COLORS, baseEmbed, formatBody, infoEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Резервные копии структуры сервера (каналы, роли)')
        .addSubcommand(sub => sub.setName('create').setDescription('Создать бэкап сейчас'))
        .addSubcommand(sub => sub.setName('list').setDescription('Показать список бэкапов'))
        .addSubcommand(sub =>
            sub
                .setName('restore')
                .setDescription('Восстановить недостающие каналы/роли из бэкапа (ничего не удаляет)')
                .addStringOption(opt =>
                    opt.setName('file').setDescription('Имя файла бэкапа (см. /backup list)').setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const filename = await security.createBackup(interaction.guild);
            const embed = baseEmbed(COLORS.success)
                .setDescription(formatBody('Бэкап создан'))
                .addFields({ name: 'Файл', value: `\`${filename}\`` });
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'list') {
            const files = security.listBackups();
            if (!files.length) {
                return interaction.reply({
                    embeds: [infoEmbed('Бэкапов пока нет.', 'Бэкапы')],
                    flags: MessageFlags.Ephemeral,
                });
            }
            const embed = baseEmbed(COLORS.primary)
                .setDescription(
                    `${formatBody('Список бэкапов')}\n\n${files
                        .slice(0, 15)
                        .map(f => `\`${f}\``)
                        .join('\n')}`
                )
                .setFooter({ text: `Всего: ${files.length}` });
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (sub === 'restore') {
            const file = interaction.options.getString('file');
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            try {
                const result = await security.restoreBackup(interaction.guild, file);
                const embed = baseEmbed(COLORS.success)
                    .setDescription(
                        formatBody(
                            'Восстановление завершено',
                            'Восстановление только добавляет недостающее — ничего не удаляет и не перезаписывает.'
                        )
                    )
                    .addFields(
                        {
                            name: 'Роли добавлены',
                            value: result.createdRoles.length ? result.createdRoles.join(', ') : 'нет',
                        },
                        {
                            name: 'Категории добавлены',
                            value: result.createdCategories.length ? result.createdCategories.join(', ') : 'нет',
                        },
                        {
                            name: 'Каналы добавлены',
                            value: result.createdChannels.length ? result.createdChannels.join(', ') : 'нет',
                        }
                    );
                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                return interaction.editReply({ embeds: [errorEmbed(err.message, 'Ошибка восстановления')] });
            }
        }
    },
};
