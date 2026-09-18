const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const voice = require('../../voice');
const { successEmbed } = require('../../utils/embeds');

// Аналог /verification-role и /commands-channel — администратор
// указывает категорию для временных комнат напрямую через Discord
// category-picker, без ожидания редеплоя. scripts/setup-temp-voice.js
// после этого использует именно её и не переименовывает (findOrCreate
// предпочитает уже настроенный ID и не трогает имя найденного канала).
module.exports = {
    data: new SlashCommandBuilder()
        .setName('temp-voice-category')
        .setDescription('Указать категорию, куда переносятся создаваемые временные комнаты')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Указать категорию')
                .addChannelOption(option =>
                    option
                        .setName('category')
                        .setDescription('Категория')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('clear').setDescription('Сбросить — снова использовать категорию по умолчанию')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'clear') {
            await voice.updateConfig(config => {
                config.roomsCategoryId = null;
            });
            await interaction.reply({
                embeds: [
                    successEmbed('Категория для временных комнат сброшена — снова используется значение по умолчанию.'),
                ],
                ephemeral: true,
            });
            return;
        }

        const category = interaction.options.getChannel('category');
        await voice.updateConfig(config => {
            config.roomsCategoryId = category.id;
        });
        await interaction.reply({
            embeds: [successEmbed(`Временные комнаты теперь создаются в категории ${category}.`)],
            ephemeral: true,
        });
    },
};
