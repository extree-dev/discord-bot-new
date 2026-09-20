const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const tickets = require('../../tickets');
const security = require('../../security');
const voice = require('../../voice');
const moderation = require('../../moderation');
const warnings = require('../../utils/warnings');
const { COLORS, baseEmbed, formatBody } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Панель модератора — сводка по тикетам, безопасности и другим системам')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const [ticketsConfig, securityConfig, voiceConfig, warningStats, mutes] = await Promise.all([
            tickets.getConfig(),
            security.getConfig(),
            voice.getConfig(),
            warnings.getWarningStats(),
            moderation.getConfig(),
        ]);
        const activeMutes = Object.keys(mutes).length;

        const ticketEntries = Object.values(ticketsConfig.tickets);
        const open = ticketEntries.filter(t => t.status !== tickets.STATUS.RESOLVED);
        const unclaimed = open.filter(t => !t.claimedBy);
        const urgent = open.filter(t => t.urgent);

        const status = enabled => (enabled ? '🟢 Включено' : '🔴 Выключено');

        const embed = baseEmbed(securityConfig.manualLockdown.active ? COLORS.critical : COLORS.primary)
            .setDescription(formatBody('Панель модератора'))
            .addFields(
                {
                    name: '🎫 Тикеты',
                    value: `Открыто: ${open.length}\nНе взято: ${unclaimed.length}\n🚨 Срочных: ${urgent.length}`,
                    inline: true,
                },
                {
                    name: '🛡️ Безопасность',
                    value:
                        `Lockdown: ${securityConfig.manualLockdown.active ? '🔴 Активен' : '🟢 Не активен'}\n` +
                        `Anti-nuke: ${status(securityConfig.antiNuke.enabled)}\n` +
                        `Raid shield: ${status(securityConfig.raidShield.enabled)}\n` +
                        `Верификация: ${status(securityConfig.verification.enabled)}`,
                    inline: true,
                },
                {
                    name: '⚠️ Предупреждения',
                    value: `Участников с варнами: ${warningStats.warnedUsers}\nВсего выдано: ${warningStats.totalWarnings}`,
                    inline: true,
                },
                {
                    name: '🔇 Муты',
                    value: `Активных сейчас: ${activeMutes}`,
                    inline: true,
                },
                {
                    name: '🔊 Временные комнаты',
                    value: `Активно: ${Object.keys(voiceConfig.channels).length}`,
                    inline: true,
                }
            )
            .setFooter({ text: 'Подробнее: /ticket list, /ticket stats, /security-status, /warnings' });

        return interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
