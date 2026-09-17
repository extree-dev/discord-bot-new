const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { load } = require('../../security/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('security-status')
        .setDescription('Показать текущие настройки системы безопасности')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const config = load();
        const logChannel = config.logChannelId ? `<#${config.logChannelId}>` : 'ещё не создан';

        const status = enabled => (enabled ? 'Включено' : 'Выключено');

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Статус системы безопасности')
            .addFields(
                { name: 'Лог-канал', value: logChannel, inline: true },
                { name: 'Доверенные ID (вручную)', value: `${config.trustedIds.length}`, inline: true },
                {
                    name: 'Роль Trusted',
                    value: config.trustedRoleId ? `<@&${config.trustedRoleId}>` : 'не задана',
                    inline: true,
                },
                {
                    name: 'Anti-nuke',
                    value: `${status(config.antiNuke.enabled)} — макс. ${config.antiNuke.maxActions} действий / ${config.antiNuke.windowMs / 1000} сек.`,
                },
                {
                    name: 'Raid shield',
                    value: `${status(config.raidShield.enabled)} — порог ${config.raidShield.joinThreshold} заходов / ${config.raidShield.windowMs / 1000} сек., lockdown ${config.raidShield.lockdownMs / 60000} мин.`,
                },
                {
                    name: 'Automod',
                    value: `${status(config.automod.enabled)} — макс. ${config.automod.maxMentions} упоминаний, ${config.automod.maxMessagesPerWindow} сообщ. / ${config.automod.messageWindowMs / 1000} сек., запрещённых слов: ${config.bannedWords.length}`,
                },
                { name: 'Audit log', value: status(config.auditLog.enabled), inline: true },
                { name: 'Верификация', value: status(config.verification.enabled), inline: true }
            )
            .setFooter({ text: 'Конфиг: data/security-config.json' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
