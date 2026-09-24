// Отдельная (не заменяющая нативную адаптацию Discord — adminPanel/
// onboarding.js/scripts/add-onboarding-role-questions.js) панель
// самостоятельного выбора ролей: постоянное сообщение с двумя
// выпадающими списками (StringSelectMenu), по образцу официального бота
// VALORANT — участник сам выбирает роли, без визарда адаптации. Первый
// список — игровые роли "играю в это" (те же 8 игр из gameNews/games.js,
// уже заведены адаптацией); второй — отдельные роли-пинги "хочу новости
// об этом" (тоже по gameNews/games.js, создаёт scripts/setup-game-
// news.js — их упомянет будущая интеграция Steam API). Панель ничего не
// создаёт сама — только находит роли по имени и хранит ID в
// rolePanel/config.js (игровые роли) и gameNews/config.js (роли-пинги).
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { baseContainer, textDisplay, separator, toEphemeralMessage } = require('../utils/components');

const GAMES_SELECT_CUSTOM_ID = 'rolepanel_games_select';
const NEWS_SELECT_CUSTOM_ID = 'rolepanel_news_select';

function buildSelectRow(customId, placeholder, games) {
    const options = games.map(game => ({ label: game.name, value: game.key, emoji: game.emoji }));
    const select = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .setMinValues(0)
        .setMaxValues(Math.max(1, options.length))
        .addOptions(options);
    return new ActionRowBuilder().addComponents(select);
}

// Каждый выбор в одном из менюшек — это ПОЛНЫЙ желаемый набор ролей
// именно этой категории (Discord не поддерживает разные "выбрано по
// умолчанию" для разных людей на одном статичном сообщении), поэтому
// явно проговорено в тексте панели: неотмеченная игра из уже имеющихся
// ролей будет снята, а не просто "к списку добавятся новые". playGames/
// newsGames — только те игры, чья роль реально нашлась на сервере (см.
// scripts/setup-role-panel.js) — пустой список просто не рисует свой
// ряд меню, вместо пункта, который ничего не сделает.
function buildPanelMessage({ playGames, newsGames }) {
    const container = baseContainer(COLORS.primary).addTextDisplayComponents(
        textDisplay('### Выбери свой путь\n-# Отметь игры, в которые играешь — так тебя будет проще позвать в команду.')
    );
    if (playGames.length) {
        container.addActionRowComponents(buildSelectRow(GAMES_SELECT_CUSTOM_ID, 'Выбери свои игры', playGames));
    }

    container.addSeparatorComponents(separator());
    container.addTextDisplayComponents(
        textDisplay(
            '### Подпишись на новости\n-# Отметь игры, новости о которых хочешь получать — бот упомянет роль, когда выйдет что-то новое.'
        )
    );
    if (newsGames.length) {
        container.addActionRowComponents(buildSelectRow(NEWS_SELECT_CUSTOM_ID, 'Подпишись на новости', newsGames));
    }

    container.addTextDisplayComponents(
        textDisplay('-# Каждый выбор полностью заменяет предыдущий в своём списке — сними отметку, чтобы убрать роль.')
    );
    return container;
}

// Чистая функция: какие роли добавить/снять, чтобы набор ролей участника
// совпал с выбором в меню. roleIds — game.key → roleId (только игры,
// роль которых реально нашлась на сервере). currentRoleIds — ID ролей,
// которые участник уже держит.
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

// Общий хвост для обоих select-меню — отличаются только формулировкой
// ответа и причиной в audit-логе Discord.
async function applySelection(interaction, roleIds, games, { reason, actionLabel, emptyText }) {
    const currentRoleIds = interaction.member.roles.cache.keys();
    const { toAdd, toRemove } = computeRoleDiff(interaction.values, roleIds, currentRoleIds);

    for (const roleId of toAdd) {
        await interaction.member.roles.add(roleId, reason).catch(() => {});
    }
    for (const roleId of toRemove) {
        await interaction.member.roles.remove(roleId, reason).catch(() => {});
    }

    const summary = describeSelection(interaction.values, games);
    const text = summary ? `${actionLabel}: ${summary}.` : emptyText;

    // deferUpdate(), а не reply()/update() с новым содержимым: без этого
    // Discord-клиент продолжает показывать в самом меню варианты
    // прошлого выбора отмеченными (роли участника при этом реально
    // меняются верно) — участник должен был вручную снимать эти
    // "залипшие" галочки при следующем открытии. deferUpdate()
    // подтверждает обработку интеракции без правки сообщения и сбрасывает
    // визуальное состояние меню обратно на плейсхолдер для этого участника.
    await interaction.deferUpdate();
    await interaction.followUp(
        toEphemeralMessage(baseContainer(COLORS.success).addTextDisplayComponents(textDisplay(text)))
    );
}

async function handleGamesSelect(interaction, roleIds, games) {
    await applySelection(interaction, roleIds, games, {
        reason: 'Панель выбора игровых ролей',
        actionLabel: 'Роли обновлены',
        emptyText: 'Роли обновлены — ни одна игра не выбрана.',
    });
}

async function handleNewsSelect(interaction, roleIds, games) {
    await applySelection(interaction, roleIds, games, {
        reason: 'Панель подписки на новости по играм',
        actionLabel: 'Подписки на новости обновлены',
        emptyText: 'Подписки на новости обновлены — ни одна игра не выбрана.',
    });
}

module.exports = {
    GAMES_SELECT_CUSTOM_ID,
    NEWS_SELECT_CUSTOM_ID,
    buildPanelMessage,
    computeRoleDiff,
    describeSelection,
    handleGamesSelect,
    handleNewsSelect,
};
