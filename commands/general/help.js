const { SlashCommandBuilder } = require('discord.js');
const { loadCommands } = require('../../utils/loadCommands');
const { COLORS, baseEmbed, formatBody } = require('../../utils/embeds');

const CATEGORY_LABELS = {
    general: 'Общие',
    moderation: 'Модерация',
};

// Команда доступна тому, у кого есть все права из default_member_permissions
// (то же самое, что Discord сам проверяет, показывать ли её в списке
// слэш-команд) — null/не задано значит "доступна всем". Без этой проверки
// /help показывал бы обычным участникам названия и описания команд вроде
// /ban или /lockdown, которые они всё равно не могут вызвать — то есть
// разделение на "для всех" и "только для админов" была бы только внешним
// видом папок commands/general и commands/moderation, а не тем, что
// реально видит пользователь.
function isVisibleTo(command, member) {
    const required = command.data.toJSON().default_member_permissions;
    if (required == null) return true;
    return member.permissions.has(BigInt(required));
}

module.exports = {
    data: new SlashCommandBuilder().setName('help').setDescription('Показать список всех доступных команд'),

    async execute(interaction) {
        const allCommands = loadCommands();
        const commands = allCommands.filter(command => isVisibleTo(command, interaction.member));

        const byCategory = new Map();
        for (const command of commands) {
            const list = byCategory.get(command.category) ?? [];
            list.push(command);
            byCategory.set(command.category, list);
        }

        const lines = [];
        for (const [category, list] of byCategory) {
            lines.push(`## ${CATEGORY_LABELS[category] ?? category}`);
            for (const command of [...list].sort((a, b) => a.data.name.localeCompare(b.data.name))) {
                lines.push(`- \`/${command.data.name}\` — ${command.data.description}`);
            }
            lines.push('');
        }

        const embed = baseEmbed(COLORS.primary)
            .setDescription(`${formatBody('Команды бота')}\n\n${lines.join('\n').trim()}`)
            .setFooter({ text: `Доступно тебе: ${commands.length} из ${allCommands.length}` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
