const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const changelog = require('../../changelog');
const { errorEmbed } = require('../../utils/embeds');
const { toEphemeralMessage } = require('../../utils/components');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('Что нового в последних обновлениях бота')
        .addIntegerOption(opt =>
            opt
                .setName('count')
                .setDescription('Сколько последних версий показать (по умолчанию 3)')
                .setMinValue(1)
                .setMaxValue(10)
        ),

    async execute(interaction) {
        const count = interaction.options.getInteger('count') ?? 3;
        const entries = changelog.getLatestEntries(count);
        if (!entries.length) {
            await interaction.reply({
                embeds: [errorEmbed('Пока нет опубликованных записей изменений.')],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.reply(toEphemeralMessage(changelog.buildChangelogSummary(entries)));
    },
};
