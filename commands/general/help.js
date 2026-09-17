const { SlashCommandBuilder } = require('discord.js');
const { loadCommands } = require('../../utils/loadCommands');
const { COLORS, baseEmbed } = require('../../utils/embeds');

const CATEGORY_LABELS = {
    general: 'Общие',
    moderation: 'Модерация',
};

module.exports = {
    data: new SlashCommandBuilder().setName('help').setDescription('Показать список всех доступных команд'),

    async execute(interaction) {
        const commands = loadCommands();

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
            .setTitle('Команды бота')
            .setDescription(lines.join('\n').trim())
            .setFooter({ text: `Всего команд: ${commands.length}` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
