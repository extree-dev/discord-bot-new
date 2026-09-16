const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { createBackup, listBackups, restoreBackup } = require('../../security/backup');

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
                .addStringOption(opt => opt.setName('file').setDescription('Имя файла бэкапа (см. /backup list)').setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            await interaction.deferReply({ ephemeral: true });
            const filename = await createBackup(interaction.guild);
            const embed = new EmbedBuilder()
                .setColor(0x57f287)
                .setTitle('Бэкап создан')
                .addFields({ name: 'Файл', value: `\`${filename}\`` })
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'list') {
            const files = listBackups();
            if (!files.length) {
                const emptyEmbed = new EmbedBuilder().setColor(0x5865f2).setDescription('Бэкапов пока нет.');
                return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle('Список бэкапов')
                .setDescription(files.slice(0, 15).map(f => `\`${f}\``).join('\n'))
                .setFooter({ text: `Всего: ${files.length}` });
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'restore') {
            const file = interaction.options.getString('file');
            await interaction.deferReply({ ephemeral: true });
            try {
                const result = await restoreBackup(interaction.guild, file);
                const embed = new EmbedBuilder()
                    .setColor(0x57f287)
                    .setTitle('Восстановление завершено')
                    .setDescription('Восстановление только добавляет недостающее — ничего не удаляет и не перезаписывает.')
                    .addFields(
                        { name: 'Роли добавлены', value: result.createdRoles.length ? result.createdRoles.join(', ') : 'нет' },
                        { name: 'Категории добавлены', value: result.createdCategories.length ? result.createdCategories.join(', ') : 'нет' },
                        { name: 'Каналы добавлены', value: result.createdChannels.length ? result.createdChannels.join(', ') : 'нет' }
                    )
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            } catch (err) {
                const errorEmbed = new EmbedBuilder().setColor(0xed4245).setTitle('Ошибка восстановления').setDescription(err.message);
                return interaction.editReply({ embeds: [errorEmbed] });
            }
        }
    },
};
