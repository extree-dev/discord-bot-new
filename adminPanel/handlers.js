// Роутинг взаимодействий панели администратора — кнопки, UserSelectMenu
// (выбор цели для точечного наказания) и модалки (причина/длительность).
// Сама доменная логика — в security/tickets/voice/moderation (тумблеры,
// бэкап, статус) и adminPanel/quickActions.js (бан/кик/мут/варн), здесь
// только разбор interaction'ов и сборка ответов.
const { PermissionFlagsBits, UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const model = require('./model');
const quickActions = require('./quickActions');
const security = require('../security');
const { errorEmbed, successEmbed } = require('../utils/embeds');

// Право то же, что у /lockdown, /backup, /security-status, /ban — все
// действия панели по чувствительности эквивалентны им, а не обычной
// модерации (ModerateMembers), поэтому Administrator, а не staff помягче.
// Канал панели и так виден только роли Admin (см.
// scripts/setup-admin-panel.js), проверка здесь — подстраховка на случай
// прямой ссылки на сообщение.
function isAdmin(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator);
}

async function refreshPanel(interaction) {
    const status = await model.gatherStatus();
    await interaction.message.edit(model.buildPanelMessage(status)).catch(() => {});
}

async function handleLockdownToggle(interaction) {
    const config = await security.getConfig();
    if (config.manualLockdown.active) {
        await security.deactivateLockdown(interaction.guild, interaction.user);
    } else {
        await security.activateLockdown(interaction.guild, interaction.user);
    }
    await refreshPanel(interaction);
}

async function handleModuleToggle(interaction, key) {
    await security.updateConfig(cfg => {
        cfg[key].enabled = !cfg[key].enabled;
    });
    await refreshPanel(interaction);
}

async function handleBackup(interaction) {
    const filename = await security.createBackup(interaction.guild);
    await refreshPanel(interaction);
    await interaction
        .followUp({ embeds: [successEmbed(`Файл: \`${filename}\``, 'Бэкап создан')], ephemeral: true })
        .catch(() => {});
}

// Просмотровые кнопки (список бэкапов, подробный статус) не меняют
// состояние — панель под ними трогать незачем, только ephemeral-ответ.
async function handleBackupList(interaction) {
    const files = security.listBackups();
    await interaction.followUp({ embeds: [model.buildBackupListEmbed(files)], ephemeral: true }).catch(() => {});
}

async function handleStatusDetail(interaction) {
    const config = await security.getConfig();
    await interaction.followUp({ embeds: [model.buildStatusDetailEmbed(config)], ephemeral: true }).catch(() => {});
}

async function handleRefresh(interaction) {
    await refreshPanel(interaction);
}

// Первый шаг точечного наказания — сама панель не трогается (это не
// state-меняющее действие), новый ephemeral-ответ с выбором участника.
async function handleQuickActionButton(interaction, action) {
    const config = model.QUICK_ACTIONS.find(a => a.key === action);
    const select = new UserSelectMenuBuilder()
        .setCustomId(`${model.QUICK_SELECT_PREFIX}${action}`)
        .setPlaceholder(`Кого? (${config.label})`)
        .setMinValues(1)
        .setMaxValues(1);
    await interaction.reply({
        content: `Выбери участника для действия «${config.label}»:`,
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
    });
}

async function handleButton(interaction) {
    const { customId } = interaction;
    const isPanelButton =
        customId === model.LOCKDOWN_TOGGLE_ID ||
        customId === model.BACKUP_ID ||
        customId === model.BACKUP_LIST_ID ||
        customId === model.STATUS_DETAIL_ID ||
        customId === model.REFRESH_ID ||
        customId.startsWith(model.TOGGLE_PREFIX) ||
        customId.startsWith(model.QUICK_ACTION_PREFIX);
    if (!isPanelButton) return false;

    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Панель администратора доступна только администраторам сервера.')],
            ephemeral: true,
        });
        return true;
    }

    // Точечные наказания — отдельная ветка, без deferUpdate: это не
    // редактирование самой панели, а новый ephemeral-диалог выбора цели.
    if (customId.startsWith(model.QUICK_ACTION_PREFIX)) {
        await handleQuickActionButton(interaction, customId.slice(model.QUICK_ACTION_PREFIX.length));
        return true;
    }

    await interaction.deferUpdate();

    if (customId === model.LOCKDOWN_TOGGLE_ID) {
        await handleLockdownToggle(interaction);
    } else if (customId === model.BACKUP_ID) {
        await handleBackup(interaction);
    } else if (customId === model.BACKUP_LIST_ID) {
        await handleBackupList(interaction);
    } else if (customId === model.STATUS_DETAIL_ID) {
        await handleStatusDetail(interaction);
    } else if (customId === model.REFRESH_ID) {
        await handleRefresh(interaction);
    } else {
        const key = customId.slice(model.TOGGLE_PREFIX.length);
        if (model.MODULES.some(m => m.key === key)) {
            await handleModuleToggle(interaction, key);
        }
    }
    return true;
}

// Шаг 2 точечного наказания — участник выбран, дальше нужна причина (и
// для мута/бана ещё пара чисел), которую select-меню собрать не может —
// открываем модалку. targetId зашивается в её customId (см. model.js).
async function handleSelectMenu(interaction) {
    if (!interaction.customId.startsWith(model.QUICK_SELECT_PREFIX)) return false;

    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Панель администратора доступна только администраторам сервера.')],
            ephemeral: true,
        });
        return true;
    }

    const action = interaction.customId.slice(model.QUICK_SELECT_PREFIX.length);
    const targetId = interaction.values[0];
    await interaction.showModal(model.buildQuickActionModal(action, targetId));
    return true;
}

// Шаг 3 (финальный) — причина/длительность собраны, выполняем то же
// самое действие, что и одноимённая слэш-команда (см.
// adminPanel/quickActions.js).
async function handleModalSubmit(interaction) {
    if (!interaction.customId.startsWith(model.QUICK_MODAL_PREFIX)) return false;

    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Панель администратора доступна только администраторам сервера.')],
            ephemeral: true,
        });
        return true;
    }

    const [action, targetId] = interaction.customId.slice(model.QUICK_MODAL_PREFIX.length).split(':');
    const target = await interaction.client.users.fetch(targetId).catch(() => null);
    if (!target) {
        await interaction.reply({ embeds: [errorEmbed('Не удалось найти этого пользователя.')], ephemeral: true });
        return true;
    }

    await interaction.deferReply({ ephemeral: true });

    const getReason = () => interaction.fields.getTextInputValue('reason')?.trim() || 'Причина не указана';
    let result;
    let successText;

    if (action === 'ban') {
        const reason = getReason();
        const rawDays = interaction.fields.getTextInputValue('deleteDays')?.trim();
        const deleteDays = Math.min(7, Math.max(0, parseInt(rawDays, 10) || 0));
        result = await quickActions.applyBan(interaction.guild, target, reason, deleteDays);
        successText = `${target} забанен. Причина: ${reason}`;
    } else if (action === 'kick') {
        const reason = getReason();
        result = await quickActions.applyKick(interaction.guild, target, reason);
        successText = `${target} кикнут. Причина: ${reason}`;
    } else if (action === 'mute') {
        const minutes = parseInt(interaction.fields.getTextInputValue('minutes')?.trim(), 10);
        if (!minutes || minutes <= 0) {
            await interaction.editReply({
                embeds: [errorEmbed('Укажи длительность мута числом минут больше нуля.')],
            });
            return true;
        }
        const reason = getReason();
        result = await quickActions.applyMute(
            interaction.guild,
            target,
            reason,
            Math.min(40320, minutes),
            interaction.user.id
        );
        successText = `${target} замучен на ${Math.min(40320, minutes)} мин. Причина: ${reason}`;
    } else {
        const reason = interaction.fields.getTextInputValue('reason').trim();
        result = await quickActions.applyWarn(interaction.guild, target, reason, interaction.user.tag);
        successText = `${target} предупреждён (всего варнов: ${result.count}). Причина: ${reason}`;
    }

    if (result.error) {
        await interaction.editReply({ embeds: [errorEmbed(result.error)] });
        return true;
    }
    await interaction.editReply({ embeds: [successEmbed(successText, 'Готово')] });
    return true;
}

module.exports = { handleButton, handleSelectMenu, handleModalSubmit };
