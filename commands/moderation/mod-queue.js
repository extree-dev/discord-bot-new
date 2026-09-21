const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const modqueue = require('../../modqueue');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

// Аналог /commands-channel и /temp-voice-category — список
// модерируемых каналов настраивается прямо командой, без редеплоя.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod-queue')
        .setDescription('Каналы, где сообщения публикуются только после одобрения модератором')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Включить проверку сообщений в канале')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Канал')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Выключить проверку сообщений в канале')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Канал')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub => sub.setName('list').setDescription('Показать список каналов с проверкой сообщений')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const config = await modqueue.getConfig();

        if (!config.reviewChannelId) {
            await interaction.reply({
                embeds: [errorEmbed('Канал проверки ещё не настроен — сначала прогони scripts/setup-modqueue.js.')],
                ephemeral: true,
            });
            return;
        }

        if (sub === 'list') {
            const list = config.moderatedChannelIds.length
                ? config.moderatedChannelIds.map(id => `<#${id}>`).join('\n')
                : 'Список пуст — проверка сообщений нигде не включена.';
            await interaction.reply({ embeds: [successEmbed(list, 'Каналы с проверкой сообщений')], ephemeral: true });
            return;
        }

        const channel = interaction.options.getChannel('channel');

        if (sub === 'add') {
            if (channel.id === config.reviewChannelId) {
                await interaction.reply({
                    embeds: [errorEmbed('Нельзя включить проверку в самом канале проверки.')],
                    ephemeral: true,
                });
                return;
            }
            await modqueue.updateConfig(cfg => {
                cfg.moderatedChannelIds = modqueue.addModeratedChannel(cfg.moderatedChannelIds, channel.id);
            });
            await interaction.reply({
                embeds: [successEmbed(`Сообщения в ${channel} теперь публикуются только после одобрения модератором.`)],
                ephemeral: true,
            });
            return;
        }

        // remove
        await modqueue.updateConfig(cfg => {
            cfg.moderatedChannelIds = modqueue.removeModeratedChannel(cfg.moderatedChannelIds, channel.id);
        });
        await interaction.reply({
            embeds: [successEmbed(`Проверка сообщений в ${channel} выключена.`)],
            ephemeral: true,
        });
    },
};
