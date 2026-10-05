const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const cases = require('../../cases');
const { COLORS, baseEmbed, formatBody, errorEmbed } = require('../../utils/embeds');

const TYPE_LABELS = {
    warn: 'Предупреждение',
    mute: 'Мут',
    ban: 'Бан',
    kick: 'Кик',
};

function formatType(type) {
    return TYPE_LABELS[type] ?? type;
}

function buildCaseEmbed(entry) {
    const embed = baseEmbed(COLORS.primary)
        .setDescription(formatBody(`Дело №${entry.id}`))
        .addFields(
            { name: 'Тип', value: formatType(entry.type), inline: true },
            { name: 'Участник', value: `<@${entry.targetId}> (${entry.targetTag})`, inline: true },
            { name: 'Модератор', value: entry.moderatorTag, inline: true },
            { name: 'Причина', value: entry.reason || 'Причина не указана' },
            { name: 'Дата', value: new Date(entry.createdAt).toLocaleString('ru-RU'), inline: true }
        );
    if (entry.extra) embed.addFields({ name: 'Детали', value: entry.extra, inline: true });
    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('case')
        .setDescription('Единый журнал наказаний — дело по номеру или все дела участника')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(sub =>
            sub
                .setName('id')
                .setDescription('Посмотреть дело по номеру')
                .addIntegerOption(opt =>
                    opt.setName('id').setDescription('Номер дела').setRequired(true).setMinValue(1)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('user')
                .setDescription('Показать последние дела участника')
                .addUserOption(opt => opt.setName('user').setDescription('Участник').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'id') {
            const id = interaction.options.getInteger('id');
            const entry = await cases.getCase(interaction.guild.id, id);
            if (!entry) {
                await interaction.reply({
                    embeds: [errorEmbed(`Дело №${id} не найдено.`)],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            await interaction.reply({ embeds: [buildCaseEmbed(entry)], flags: MessageFlags.Ephemeral });
            return;
        }

        // user
        const target = interaction.options.getUser('user');
        const list = await cases.getCasesForUser(interaction.guild.id, target.id);
        if (list.length === 0) {
            await interaction.reply({
                embeds: [
                    baseEmbed(COLORS.primary)
                        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
                        .setDescription(formatBody('Дела', 'У этого участника нет зафиксированных дел.')),
                ],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const embed = baseEmbed(COLORS.primary)
            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
            .setDescription(
                `${formatBody('Дела')}\n\n${list
                    .map(
                        c =>
                            `**№${c.id}** [${formatType(c.type)}] ${c.reason || 'без причины'} — ${c.moderatorTag} (${new Date(c.createdAt).toLocaleString('ru-RU')})`
                    )
                    .join('\n')}`
            )
            .setFooter({ text: `Показаны последние ${list.length} · ID: ${target.id}` });
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
