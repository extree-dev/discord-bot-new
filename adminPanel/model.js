// Панель администратора — постоянное сообщение в staff-only канале с
// кнопками на самые частые/тяжёлые админские действия (экстренная
// блокировка, модули безопасности, бэкап, статус, точечные наказания)
// вместо похода в слэш-команды (/lockdown, /security-status, /backup,
// /dashboard, /ban, /kick, /timeout, /warn остаются рабочими — панель не
// замена, а более быстрый путь к тем же действиям). Кнопки читают и
// правят тот же security-config, что и команды, поэтому оба входа всегда
// показывают согласованное состояние.
//
// Все кнопки — единый серый Secondary, без цветового кодирования и без
// эмодзи (по прямому запросу администратора): состояние тумблеров читается
// из подписи самой кнопки ("Anti-nuke: вкл"/"выкл"), тип действия — из
// текста лейбла, а не из значка или цвета.
const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    SeparatorSpacingSize,
} = require('discord.js');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');
const { COLORS, formatBody, baseEmbed, infoEmbed } = require('../utils/embeds');
const security = require('../security');
const tickets = require('../tickets');
const voice = require('../voice');
const moderation = require('../moderation');
const warnings = require('../utils/warnings');
const onboarding = require('./onboarding');

const LOCKDOWN_TOGGLE_ID = 'admin_panel_lockdown_toggle';
const TOGGLE_PREFIX = 'admin_panel_toggle:';
const BACKUP_ID = 'admin_panel_backup';
const BACKUP_LIST_ID = 'admin_panel_backup_list';
const STATUS_DETAIL_ID = 'admin_panel_status_detail';
const REFRESH_ID = 'admin_panel_refresh';
const QUICK_ACTION_PREFIX = 'admin_panel_quick:';
const QUICK_SELECT_PREFIX = 'admin_panel_quick_select:';
const QUICK_MODAL_PREFIX = 'admin_panel_quick_modal:';
const UNDO_ACTION_PREFIX = 'admin_panel_undo:';
const UNDO_SELECT_PREFIX = 'admin_panel_undo_select:';
const UNDO_MODAL_PREFIX = 'admin_panel_undo_modal:';

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

// Точечные наказания — то же самое, что /ban, /kick, /timeout, /warn, но
// кнопкой вместо ввода команды с параметрами. Кнопка сама по себе
// параметров нести не может (в отличие от слэш-команды), поэтому по клику
// сперва просят выбрать участника (UserSelectMenu), а затем — причину (и
// для мута/бана ещё пару чисел) через модалку. Видит эту цепочку тот же
// staff-only канал панели, поэтому отдельного подтверждения "точно?" нет.
const QUICK_ACTIONS = [
    { key: 'ban', label: 'Бан' },
    { key: 'kick', label: 'Кик' },
    { key: 'mute', label: 'Мут' },
    { key: 'warn', label: 'Варн' },
];

// Отмена наказания — в отличие от QUICK_ACTIONS не всем нужна модалка:
// unban работает по ID (забаненный уже не участник гильдии, его не
// выбрать через UserSelectMenu — тот же расклад, что у /unban), а
// unmute/unwarn не запрашивают причину (как /timeout minutes:0 и
// /warnings clear:true), поэтому select сразу выполняет действие.
const UNDO_ACTIONS = [
    { key: 'unban', label: 'Разбан', flow: 'modal' },
    { key: 'unmute', label: 'Размут', flow: 'select' },
    { key: 'unwarn', label: 'Снять варн', flow: 'select' },
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
    const state = enabled => (enabled ? 'Включён' : 'Выключен');

    // Кнопки — не отдельным блоком в конце сообщения, а вложены в
    // контейнер (ContainerBuilder#addActionRowComponents) сразу под
    // текстом своей секции: так видно, к какому статусу/списку относится
    // каждый ряд, а не приходится сопоставлять их самому.
    const lockdownRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(LOCKDOWN_TOGGLE_ID)
            .setLabel(lockdownActive ? 'Снять блокировку' : 'Заблокировать сервер')
            .setStyle(ButtonStyle.Secondary)
    );

    // 5 тумблеров — ровно потолок ActionRow (максимум 5 кнопок в ряду у
    // Discord), поэтому дальше уже не добавить без второго ряда тумблеров.
    const toggleRow = new ActionRowBuilder().addComponents(
        ...MODULES.map(m =>
            new ButtonBuilder()
                .setCustomId(`${TOGGLE_PREFIX}${m.key}`)
                .setLabel(`${m.label}: ${securityConfig[m.key].enabled ? 'вкл' : 'выкл'}`)
                .setStyle(ButtonStyle.Secondary)
        )
    );

    const quickActionRow = new ActionRowBuilder().addComponents(
        ...QUICK_ACTIONS.map(a =>
            new ButtonBuilder()
                .setCustomId(`${QUICK_ACTION_PREFIX}${a.key}`)
                .setLabel(a.label)
                .setStyle(ButtonStyle.Secondary)
        )
    );

    const undoActionRow = new ActionRowBuilder().addComponents(
        ...UNDO_ACTIONS.map(a =>
            new ButtonBuilder()
                .setCustomId(`${UNDO_ACTION_PREFIX}${a.key}`)
                .setLabel(a.label)
                .setStyle(ButtonStyle.Secondary)
        )
    );

    // 5 кнопок — снова потолок ActionRow; "Адаптация" открывает отдельное
    // ephemeral-сообщение со своими кнопками (adminPanel/onboarding.js),
    // а не встроена в этот ряд саму по себе — у панели уже 5 рядов из 5
    // (максимум ActionRow на сообщение), добавить ещё один ряд сюда было
    // бы нельзя.
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BACKUP_ID).setLabel('Создать бэкап').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(BACKUP_LIST_ID).setLabel('Список бэкапов').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(STATUS_DETAIL_ID).setLabel('Подробный статус').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(REFRESH_ID).setLabel('Обновить').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(onboarding.OPEN_ID).setLabel('Адаптация').setStyle(ButtonStyle.Secondary)
    );

    const container = baseContainer(lockdownActive ? COLORS.critical : COLORS.primary)
        .addTextDisplayComponents(
            textDisplay(formatBody('Панель администратора', 'Кнопки ниже дублируют самые частые команды модерации.'))
        )
        .addSeparatorComponents(separator(SeparatorSpacingSize.Large))
        .addTextDisplayComponents(
            textDisplay(
                [
                    '### Статус безопасности',
                    `- **Lockdown** — ${lockdownActive ? 'Активен' : 'Не активен'}`,
                    ...MODULES.map(m => `- **${m.label}** — ${state(securityConfig[m.key].enabled)}`),
                ].join('\n')
            )
        )
        .addActionRowComponents(lockdownRow, toggleRow)
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(textDisplay('### Точечные наказания'))
        .addActionRowComponents(quickActionRow)
        .addTextDisplayComponents(textDisplay('-# Отменить наказание:'))
        .addActionRowComponents(undoActionRow)
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            textDisplay(
                [
                    '### Сводка сервера',
                    `- Жалоб на игроков за 30 дней: \`${status.recentReports}\``,
                    `- Участников с варнами: \`${status.warnedUsers}\` · всего выдано: \`${status.totalWarnings}\``,
                    `- Активных мутов: \`${status.activeMutes}\``,
                    `- Активных временных комнат: \`${status.activeVoiceChannels}\``,
                    `- Бэкапов сохранено: \`${status.backupsCount}\``,
                ].join('\n')
            )
        )
        .addSeparatorComponents(separator())
        .addActionRowComponents(actionRow);

    return toMessage(container);
}

// Модалка под конкретное точечное наказание — поля разные (мут просит
// длительность, варн требует причину, бан/кик — причина опциональна).
// targetId зашит в customId, потому что submit модалки — отдельный
// interaction без доступа к выбору из предыдущего UserSelectMenu.
function buildQuickActionModal(action, targetId) {
    const modal = new ModalBuilder().setCustomId(`${QUICK_MODAL_PREFIX}${action}:${targetId}`);
    const reasonInput = (required = false) =>
        new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Причина')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(required);

    if (action === 'ban') {
        modal.setTitle('Бан участника');
        modal.addComponents(
            new ActionRowBuilder().addComponents(reasonInput(false)),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('deleteDays')
                    .setLabel('Удалить сообщения за N дней (0-7)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('0')
                    .setRequired(false)
            )
        );
    } else if (action === 'kick') {
        modal.setTitle('Кик участника');
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput(false)));
    } else if (action === 'mute') {
        modal.setTitle('Мут участника');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('minutes')
                    .setLabel('На сколько минут')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('60')
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(reasonInput(false))
        );
    } else {
        modal.setTitle('Предупреждение участнику');
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput(true)));
    }
    return modal;
}

// Модалка для unban (см. UNDO_ACTIONS выше) — единственная отмена с
// flow: 'modal', потому что забаненный уже не участник гильдии и не
// выбирается через UserSelectMenu; ID вводится вручную, как у /unban.
function buildUndoModal() {
    return new ModalBuilder()
        .setCustomId(`${UNDO_MODAL_PREFIX}unban`)
        .setTitle('Разбан по ID')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('userId')
                    .setLabel('ID пользователя')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );
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
    buildQuickActionModal,
    buildUndoModal,
    buildStatusDetailEmbed,
    buildBackupListEmbed,
    LOCKDOWN_TOGGLE_ID,
    TOGGLE_PREFIX,
    BACKUP_ID,
    BACKUP_LIST_ID,
    STATUS_DETAIL_ID,
    REFRESH_ID,
    QUICK_ACTION_PREFIX,
    QUICK_SELECT_PREFIX,
    QUICK_MODAL_PREFIX,
    UNDO_ACTION_PREFIX,
    UNDO_SELECT_PREFIX,
    UNDO_MODAL_PREFIX,
    MODULES,
    QUICK_ACTIONS,
    UNDO_ACTIONS,
};
