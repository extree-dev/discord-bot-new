// Панель администратора — постоянное сообщение в staff-only канале с
// кнопками на самые частые/тяжёлые админские действия (экстренная
// блокировка, модули безопасности, бэкап) вместо похода в слэш-команды
// (/lockdown, /security-status, /backup остаются рабочими — панель не
// замена, а более быстрый путь к тем же действиям). Кнопки читают и
// правят тот же security-config, что и команды, поэтому оба входа всегда
// показывают согласованное состояние.
const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');
const { COLORS, formatBody } = require('../utils/embeds');
const security = require('../security');
const tickets = require('../tickets');
const voice = require('../voice');
const moderation = require('../moderation');
const warnings = require('../utils/warnings');

const LOCKDOWN_TOGGLE_ID = 'admin_panel_lockdown_toggle';
const TOGGLE_PREFIX = 'admin_panel_toggle:';
const BACKUP_ID = 'admin_panel_backup';
const REFRESH_ID = 'admin_panel_refresh';

// Модули security-config, для которых на панели есть кнопка-тумблер —
// каждая просто читает/пишет config.<key>.enabled, остальные настройки
// модуля (пороги, окна и т.п.) панель не трогает, для них по-прежнему
// нужен код/БД напрямую (см. README).
const MODULES = [
    { key: 'antiNuke', label: 'Anti-nuke' },
    { key: 'raidShield', label: 'Raid shield' },
    { key: 'automod', label: 'Automod' },
    { key: 'verification', label: 'Верификация' },
];

// Единственное место, которое реально знает, как считается статус —
// buildPanelMessage() и handlers.js оба зовут только это, вручную поля
// нигде больше не собираются.
async function gatherStatus() {
    const [ticketsConfig, securityConfig, voiceConfig, warningStats, mutes] = await Promise.all([
        tickets.getConfig(),
        security.getConfig(),
        voice.getConfig(),
        warnings.getWarningStats(),
        moderation.getConfig(),
    ]);

    const recentReports = ticketsConfig.reports.filter(
        r => Date.now() - r.createdAt <= tickets.REPORT_HISTORY_WINDOW_MS
    ).length;

    return {
        securityConfig,
        recentReports,
        activeMutes: Object.keys(mutes).length,
        activeVoiceChannels: Object.keys(voiceConfig.channels).length,
        warnedUsers: warningStats.warnedUsers,
        totalWarnings: warningStats.totalWarnings,
        backupsCount: security.listBackups().length,
    };
}

// Чистая функция сборки — принимает уже готовый status (см. gatherStatus),
// сама Discord API не трогает, поэтому тестируется отдельно.
function buildPanelMessage(status) {
    const { securityConfig } = status;
    const lockdownActive = securityConfig.manualLockdown.active;
    const dot = enabled => (enabled ? '🟢' : '🔴');

    const container = baseContainer(lockdownActive ? COLORS.critical : COLORS.primary)
        .addTextDisplayComponents(
            textDisplay(formatBody('Панель администратора', 'Кнопки ниже дублируют самые частые команды модерации.'))
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            textDisplay(
                [
                    `**Lockdown:** ${lockdownActive ? '🔴 Активен' : '🟢 Не активен'}`,
                    ...MODULES.map(
                        m =>
                            `**${m.label}:** ${dot(securityConfig[m.key].enabled)} ${securityConfig[m.key].enabled ? 'Включено' : 'Выключено'}`
                    ),
                ].join('\n')
            )
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            textDisplay(
                [
                    `Жалоб на игроков за 30 дней: ${status.recentReports}`,
                    `Участников с варнами: ${status.warnedUsers} · всего выдано: ${status.totalWarnings}`,
                    `Активных мутов: ${status.activeMutes}`,
                    `Активных временных комнат: ${status.activeVoiceChannels}`,
                    `Бэкапов сохранено: ${status.backupsCount}`,
                ].join('\n')
            )
        );

    const lockdownRow = new ActionRowBuilder().addComponents(
        lockdownActive
            ? new ButtonBuilder()
                  .setCustomId(LOCKDOWN_TOGGLE_ID)
                  .setLabel('Снять блокировку')
                  .setEmoji('🔓')
                  .setStyle(ButtonStyle.Success)
            : new ButtonBuilder()
                  .setCustomId(LOCKDOWN_TOGGLE_ID)
                  .setLabel('Экстренная блокировка')
                  .setEmoji('🔒')
                  .setStyle(ButtonStyle.Danger)
    );

    const toggleRow = new ActionRowBuilder().addComponents(
        ...MODULES.map(m =>
            new ButtonBuilder()
                .setCustomId(`${TOGGLE_PREFIX}${m.key}`)
                .setLabel(m.label)
                .setEmoji(dot(securityConfig[m.key].enabled))
                .setStyle(securityConfig[m.key].enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
        )
    );

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(BACKUP_ID)
            .setLabel('Создать бэкап')
            .setEmoji('💾')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(REFRESH_ID).setLabel('Обновить').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
    );

    return toMessage(container, lockdownRow, toggleRow, actionRow);
}

module.exports = {
    gatherStatus,
    buildPanelMessage,
    LOCKDOWN_TOGGLE_ID,
    TOGGLE_PREFIX,
    BACKUP_ID,
    REFRESH_ID,
    MODULES,
};
