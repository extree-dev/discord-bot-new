// Отдельная (не заменяющая нативную адаптацию Discord — adminPanel/
// onboarding.js/scripts/add-onboarding-role-questions.js) панель
// самостоятельного выбора игровых ролей: постоянное сообщение с
// выпадающим списком (StringSelectMenu), по образцу официального бота
// VALORANT — участник сам выбирает роли, без визарда адаптации. Роли —
// те же 8 игр из gameNews/games.js (общий список с новостными
// каналами), их саму панель не создаёт — только находит по имени
// (уже заведены адаптацией) и хранит ID в rolePanel/config.js.
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { baseContainer, textDisplay, separator, toEphemeralMessage } = require('../utils/components');

const SELECT_CUSTOM_ID = 'rolepanel_games_select';

// Каждый выбор в меню — это ПОЛНЫЙ желаемый набор игровых ролей
// участника (Discord не поддерживает разные "выбрано по умолчанию" для
// разных людей на одном статичном сообщении), поэтому явно проговорено
// в тексте панели: неотмеченная игра из уже имеющихся ролей будет
// снята, а не просто "к списку добавятся новые".
function buildPanelMessage(games) {
    const options = games.map(game => ({ label: game.name, value: game.key, emoji: game.emoji }));
    const select = new StringSelectMenuBuilder()
        .setCustomId(SELECT_CUSTOM_ID)
        .setPlaceholder('Выбери свои игры')
        .setMinValues(0)
        .setMaxValues(Math.max(1, options.length))
        .addOptions(options);

    return baseContainer(COLORS.primary)
        .addTextDisplayComponents(
            textDisplay(
                '### Выбери свой путь\n-# Отметь игры, в которые играешь — так тебя будет проще позвать в команду, и ты увидишь новости именно по своим играм.'
            )
        )
        .addSeparatorComponents(separator())
        .addActionRowComponents(new ActionRowBuilder().addComponents(select))
        .addTextDisplayComponents(
            textDisplay('-# Список в меню полностью заменяет твой предыдущий выбор — сними отметку, чтобы убрать роль.')
        );
}

// Чистая функция: какие роли добавить/снять, чтобы набор ролей участника
// совпал с выбором в меню. roleIds — game.key → roleId (только игры,
// роль которых реально нашлась на сервере — см. scripts/setup-role-
// panel.js). currentRoleIds — ID ролей, которые участник уже держит.
function computeRoleDiff(selectedKeys, roleIds, currentRoleIds) {
    const trackedRoleIds = Object.values(roleIds).filter(Boolean);
    const selectedRoleIds = [...new Set(selectedKeys.map(key => roleIds[key]).filter(Boolean))];
    const currentSet = new Set(currentRoleIds);
    const toAdd = selectedRoleIds.filter(id => !currentSet.has(id));
    const toRemove = trackedRoleIds.filter(id => currentSet.has(id) && !selectedRoleIds.includes(id));
    return { toAdd, toRemove };
}

function describeSelection(selectedKeys, games) {
    const names = games.filter(game => selectedKeys.includes(game.key)).map(game => game.name);
    return names.length ? names.join(', ') : null;
}

async function handleGamesSelect(interaction, roleIds, games) {
    const currentRoleIds = interaction.member.roles.cache.keys();
    const { toAdd, toRemove } = computeRoleDiff(interaction.values, roleIds, currentRoleIds);

    for (const roleId of toAdd) {
        await interaction.member.roles.add(roleId, 'Панель выбора игровых ролей').catch(() => {});
    }
    for (const roleId of toRemove) {
        await interaction.member.roles.remove(roleId, 'Панель выбора игровых ролей').catch(() => {});
    }

    const summary = describeSelection(interaction.values, games);
    const text = summary ? `Роли обновлены: ${summary}.` : 'Роли обновлены — ни одна игра не выбрана.';
    await interaction.reply(
        toEphemeralMessage(baseContainer(COLORS.success).addTextDisplayComponents(textDisplay(text)))
    );
}

module.exports = {
    SELECT_CUSTOM_ID,
    buildPanelMessage,
    computeRoleDiff,
    describeSelection,
    handleGamesSelect,
};
