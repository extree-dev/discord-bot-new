const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const commandsChannel = require('../../commandsChannel');
const { successEmbed } = require('../../utils/embeds');

// Ограничивает только команды категории "general" (см. index.js) —
// команды модерации нужны там, где случилась проблема (например, /warn
// в канале нарушения), а не в одном выделенном канале.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('commands-channel')
        .setDescription('Ограничить общие команды бота одним каналом')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Указать канал, где разрешены общие команды')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Канал')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('clear').setDescription('Снять ограничение — общие команды снова доступны везде')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'clear') {
            await commandsChannel.updateConfig(config => {
                config.channelId = null;
            });
            await interaction.reply({
                embeds: [successEmbed('Общие команды снова доступны в любом канале.')],
                ephemeral: true,
            });
            return;
        }

        const channel = interaction.options.getChannel('channel');
        await commandsChannel.updateConfig(config => {
            config.channelId = channel.id;
        });
        await interaction.reply({
            embeds: [successEmbed(`Общие команды теперь доступны только в ${channel}.`)],
            ephemeral: true,
        });
    },
};
