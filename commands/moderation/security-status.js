const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const security = require('../../security');
const { COLORS, baseEmbed, formatBody } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('security-status')
        .setDescription('Показать текущие настройки системы безопасности')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const config = await security.getConfig();
        const logChannel = config.logChannelId ? `<#${config.logChannelId}>` : 'ещё не создан';

        const status = enabled => (enabled ? 'Включено' : 'Выключено');

        const lines = [];
        if (config.manualLockdown.active) {
            lines.push(
                '## Lockdown: активен',
                `- Каналов заблокировано: ${config.manualLockdown.channelIds.length}`,
                ''
            );
        }
        lines.push(
            '### Anti-nuke',
            `- ${status(config.antiNuke.enabled)} — макс. ${config.antiNuke.maxActions} действий / ${config.antiNuke.windowMs / 1000} сек.`,
            '',
            '### Raid shield',
            `- ${status(config.raidShield.enabled)} — порог ${config.raidShield.joinThreshold} заходов / ${config.raidShield.windowMs / 1000} сек., lockdown ${config.raidShield.lockdownMs / 60000} мин.`,
            '',
            '### Automod',
            `- ${status(config.automod.enabled)} — макс. ${config.automod.maxMentions} упоминаний, ${config.automod.maxMessagesPerWindow} сообщ. / ${config.automod.messageWindowMs / 1000} сек.`,
            `- Запрещённых слов в списке: ${config.bannedWords.length}`,
            '',
            '### Прочее',
            `- Audit log: ${status(config.auditLog.enabled)}`,
            `- Верификация: ${status(config.verification.enabled)}`
        );

        const embed = baseEmbed(config.manualLockdown.active ? COLORS.critical : COLORS.primary)
            .setDescription(`${formatBody('Статус системы безопасности')}\n\n${lines.join('\n')}`)
            .addFields(
                { name: 'Лог-канал', value: logChannel, inline: true },
                { name: 'Доверенные ID (вручную)', value: `${config.trustedIds.length}`, inline: true },
                {
                    name: 'Роль Trusted',
                    value: config.trustedRoleId ? `<@&${config.trustedRoleId}>` : 'не задана',
                    inline: true,
                }
            )
            .setFooter({ text: 'Конфиг хранится в PostgreSQL (bot_stores.security-config)' });

        return interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
