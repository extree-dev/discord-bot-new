const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
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

        // Система тикетов больше не ведёт жизненный цикл обращений
        // (только форма → карточка стафу, см. tickets/model.js) — считать
        // тут нечего, кроме истории жалоб на игроков за 30 дней.
        const recentReports = ticketsConfig.reports.filter(
            r => Date.now() - r.createdAt <= tickets.REPORT_HISTORY_WINDOW_MS
        ).length;

        const status = enabled => (enabled ? '🟢 Включено' : '🔴 Выключено');

        const embed = baseEmbed(securityConfig.manualLockdown.active ? COLORS.critical : COLORS.primary)
            .setDescription(formatBody('Панель модератора'))
            .addFields(
                {
                    name: '🎫 Обращения',
                    value: `Жалоб на игроков за 30 дней: ${recentReports}`,
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
            .setFooter({ text: 'Подробнее: /security-status, /warnings' });

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
