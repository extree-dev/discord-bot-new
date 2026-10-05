const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const notes = require('../../notes');
const { COLORS, baseEmbed, formatBody, errorEmbed, successEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('note')
        .setDescription('Заметки модерации на участника — не наказание, участнику не видны')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Добавить заметку')
                .addUserOption(opt => opt.setName('user').setDescription('Участник').setRequired(true))
                .addStringOption(opt => opt.setName('text').setDescription('Текст заметки').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('list')
                .setDescription('Показать заметки на участника')
                .addUserOption(opt => opt.setName('user').setDescription('Участник').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Удалить заметку по номеру')
                .addUserOption(opt => opt.setName('user').setDescription('Участник').setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('index').setDescription('Номер заметки из /note list').setRequired(true).setMinValue(1)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser('user');

        if (sub === 'add') {
            const text = interaction.options.getString('text');
            await notes.addNote(interaction.guild.id, target.id, text, interaction.user.tag);
            const embed = baseEmbed(COLORS.success)
                .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
                .setDescription(formatBody('Заметка добавлена'))
                .addFields(
                    { name: 'Участник', value: `${target}`, inline: true },
                    { name: 'Автор', value: `${interaction.user}`, inline: true },
                    { name: 'Текст', value: text }
                );
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'list') {
            const list = await notes.getNotes(interaction.guild.id, target.id);
            if (list.length === 0) {
                await interaction.reply({
                    embeds: [
                        baseEmbed(COLORS.primary)
                            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
                            .setDescription(formatBody('Заметки', 'Для этого участника заметок нет.')),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const embed = baseEmbed(COLORS.primary)
                .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
                .setDescription(
                    `${formatBody('Заметки')}\n\n${list
                        .map(
                            (n, i) =>
                                `**${i + 1}.** ${n.text} — от ${n.authorTag} (${new Date(n.date).toLocaleString('ru-RU')})`
                        )
                        .join('\n')}`
                )
                .setFooter({ text: `Всего: ${list.length} · ID: ${target.id}` });
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        // remove
        const index = interaction.options.getInteger('index');
        const result = await notes.removeNote(interaction.guild.id, target.id, index);
        if (!result.removed) {
            await interaction.reply({
                embeds: [errorEmbed(`Заметки с номером ${index} у этого участника нет.`)],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.reply({
            embeds: [successEmbed(`Заметка №${index} удалена.`)],
            flags: MessageFlags.Ephemeral,
        });
    },
};
