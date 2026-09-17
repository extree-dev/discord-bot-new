const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { COLORS, baseEmbed, formatBody } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder().setName('serverinfo').setDescription('Показать информацию о сервере'),

    async execute(interaction) {
        const guild = interaction.guild;
        const owner = await guild.fetchOwner().catch(() => null);

        const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;

        const lines = [
            '### Основное',
            `- Владелец: ${owner ? `${owner}` : 'неизвестно'}`,
            `- Создан: <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
            `- Участников: ${guild.memberCount}`,
            '',
            '### Каналы',
            `- Текстовых: ${textChannels}`,
            `- Голосовых: ${voiceChannels}`,
            `- Ролей: ${guild.roles.cache.size}`,
            '',
            '### Boost',
            `- Уровень: ${guild.premiumTier === 0 ? 'нет' : guild.premiumTier}`,
            `- Бустов: ${guild.premiumSubscriptionCount ?? 0}`,
        ];

        const embed = baseEmbed(COLORS.primary)
            .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
            .setDescription(`${formatBody(guild.name)}\n\n${lines.join('\n')}`)
            .setFooter({ text: `ID: ${guild.id}` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
