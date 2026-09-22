// Панель администратора — постоянное сообщение в staff-only канале с
// кнопками на самые частые/тяжёлые админские действия (экстренная
// блокировка, модули безопасности, бэкап, статус) вместо похода в слэш-
// команды (/lockdown, /security-status, /backup, /dashboard остаются
// рабочими — панель не замена, а более быстрый путь к тем же действиям).
// Кнопки читают и правят тот же security-config, что и команды, поэтому
// оба входа всегда показывают согласованное состояние.
const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');
const { COLORS, formatBody, baseEmbed, infoEmbed } = require('../utils/embeds');
const security = require('../security');
const tickets = require('../tickets');
const voice = require('../voice');
const moderation = require('../moderation');
const warnings = require('../utils/warnings');

const LOCKDOWN_TOGGLE_ID = 'admin_panel_lockdown_toggle';
const TOGGLE_PREFIX = 'admin_panel_toggle:';
const BACKUP_ID = 'admin_panel_backup';
const BACKUP_LIST_ID = 'admin_panel_backup_list';
const STATUS_DETAIL_ID = 'admin_panel_status_detail';
const REFRESH_ID = 'admin_panel_refresh';

// Модули security-config, для которых на панели есть кнопка-тумблер —
// каждая просто читает/пишет config.<key>.enabled, остальные настройки
// модуля (пороги, окна и т.п.) панель не трогает, для них по-прежнему
// нужен код/БД напрямую (см. README) или кнопка "Подробный статус" ниже
// (только просмотр, без правки).
const MODULES = [
    { key: 'antiNuke', label: 'Anti-nuke' },
    { key: 'raidShield', label: 'Raid shield' },
    { key: 'automod', label: 'Automod' },
    { key: 'verification', label: 'Верификация' },
    { key: 'auditLog', label: 'Audit log' },
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

    // 5 тумблеров — ровно потолок ActionRow (максимум 5 кнопок в ряду у
    // Discord), поэтому дальше уже не добавить без второго ряда тумблеров.
    const toggleRow = new ActionRowBuilder().addComponents(
        ...MODULES.map(m =>
            new ButtonBuilder()
                .setCustomId(`${TOGGLE_PREFIX}${m.key}`)
                .setLabel(m.label)
                .setEmoji(dot(securityConfig[m.key].enabled))
                .setStyle(securityConfig[m.key].enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
        )
    );

    // Primary (не серый Secondary) — только у кнопок, которые реально
    // что-то ДЕЛАЮТ (создают бэкап, открывают подробный отчёт); чисто
    // просмотровые/служебные ("Список бэкапов", "Обновить") остаются
    // серыми — так с одного взгляда на цвет понятно, повлияет кнопка на
    // сервер или просто покажет данные.
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(BACKUP_ID)
            .setLabel('Создать бэкап')
            .setEmoji('💾')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(BACKUP_LIST_ID)
            .setLabel('Список бэкапов')
            .setEmoji('🗂️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(STATUS_DETAIL_ID)
            .setLabel('Подробный статус')
            .setEmoji('📊')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(REFRESH_ID).setLabel('Обновить').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
    );

    return toMessage(container, lockdownRow, toggleRow, actionRow);
}

// Тот же отчёт, что у /security-status, но как ephemeral-ответ на кнопку
// (см. handlers.js) — пороги/окна модулей и список доверенных, которые на
// саму панель не поместились бы без потери читаемости.
function buildStatusDetailEmbed(config) {
    const status = enabled => (enabled ? 'Включено' : 'Выключено');
    const logChannel = config.logChannelId ? `<#${config.logChannelId}>` : 'ещё не создан';

    const lines = [];
    if (config.manualLockdown.active) {
        lines.push('## Lockdown: активен', `- Каналов заблокировано: ${config.manualLockdown.channelIds.length}`, '');
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

    return baseEmbed(config.manualLockdown.active ? COLORS.critical : COLORS.primary)
        .setDescription(`${formatBody('Подробный статус безопасности')}\n\n${lines.join('\n')}`)
        .addFields(
            { name: 'Лог-канал', value: logChannel, inline: true },
            { name: 'Доверенные ID (вручную)', value: `${config.trustedIds.length}`, inline: true },
            {
                name: 'Роль Trusted',
                value: config.trustedRoleId ? `<@&${config.trustedRoleId}>` : 'не задана',
                inline: true,
            }
        );
}

// Тот же список, что у /backup list, ephemeral-ответом на кнопку.
function buildBackupListEmbed(files) {
    if (!files.length) return infoEmbed('Бэкапов пока нет.', 'Бэкапы');
    return baseEmbed(COLORS.primary)
        .setDescription(
            `${formatBody('Список бэкапов')}\n\n${files
                .slice(0, 15)
                .map(f => `\`${f}\``)
                .join('\n')}`
        )
        .setFooter({ text: `Всего: ${files.length}` });
}

module.exports = {
    gatherStatus,
    buildPanelMessage,
    buildStatusDetailEmbed,
    buildBackupListEmbed,
    LOCKDOWN_TOGGLE_ID,
    TOGGLE_PREFIX,
    BACKUP_ID,
    BACKUP_LIST_ID,
    STATUS_DETAIL_ID,
    REFRESH_ID,
    MODULES,
};
