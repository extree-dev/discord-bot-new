// Роутинг кнопок панели администратора — разбор customId и делегирование
// в security/tickets/voice/moderation, сама доменная логика (что значит
// "включить anti-nuke" и т.п.) там же, где и для слэш-команд, панель её
// не дублирует.
const { PermissionFlagsBits } = require('discord.js');
const model = require('./model');
const security = require('../security');
const { errorEmbed, successEmbed } = require('../utils/embeds');

// Право то же, что у /lockdown, /backup, /security-status — все действия
// панели по чувствительности эквивалентны им, а не обычной модерации
// (ModerateMembers), поэтому Administrator, а не staff помягче. Канал
// панели и так виден только роли Admin (см. scripts/setup-admin-panel.js),
// проверка здесь — подстраховка на случай прямой ссылки на сообщение.
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

async function handleRefresh(interaction) {
    await refreshPanel(interaction);
}

async function handleButton(interaction) {
    const { customId } = interaction;
    const isPanelButton =
        customId === model.LOCKDOWN_TOGGLE_ID ||
        customId === model.BACKUP_ID ||
        customId === model.REFRESH_ID ||
        customId.startsWith(model.TOGGLE_PREFIX);
    if (!isPanelButton) return false;

    if (!isAdmin(interaction.member)) {
        await interaction.reply({
            embeds: [errorEmbed('Панель администратора доступна только администраторам сервера.')],
            ephemeral: true,
        });
        return true;
    }

    await interaction.deferUpdate();

    if (customId === model.LOCKDOWN_TOGGLE_ID) {
        await handleLockdownToggle(interaction);
    } else if (customId === model.BACKUP_ID) {
        await handleBackup(interaction);
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

module.exports = { handleButton };
