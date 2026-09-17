const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getWarnings, clearWarnings } = require('../../utils/warnings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Показать или очистить предупреждения участника')
        .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))
        .addBooleanOption(option =>
            option.setName('clear').setDescription('Очистить все предупреждения').setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const shouldClear = interaction.options.getBoolean('clear') ?? false;

        if (shouldClear) {
            await clearWarnings(interaction.guild.id, target.id);
            const clearedEmbed = new EmbedBuilder()
                .setColor(0x57f287)
                .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
                .setTitle('Предупреждения очищены')
                .addFields({ name: 'Модератор', value: `${interaction.user}`, inline: true })
                .setTimestamp();
            return interaction.reply({ embeds: [clearedEmbed], ephemeral: true });
        }

        const warnings = await getWarnings(interaction.guild.id, target.id);

        if (warnings.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
                .setDescription('У этого участника нет предупреждений.');
            return interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0xfee75c)
            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
            .setTitle('Предупреждения')
            .setDescription(
                warnings
                    .map(
                        (w, i) =>
                            `**${i + 1}.** ${w.reason} — от ${w.moderatorTag} (${new Date(w.date).toLocaleString('ru-RU')})`
                    )
                    .join('\n')
            )
            .setFooter({ text: `Всего: ${warnings.length} · ID: ${target.id}` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
