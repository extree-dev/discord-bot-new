// Отдельная (не заменяющая нативную адаптацию Discord — adminPanel/
// onboarding.js/scripts/add-onboarding-role-questions.js) панель
// самостоятельного выбора ролей: постоянное сообщение с выпадающими
// списками (StringSelectMenu), по образцу официального бота VALORANT —
// участник сам выбирает роли, без визарда адаптации. Первый список —
// игровые роли "играю в это" (те же 8 игр из gameNews/games.js, уже
// заведены адаптацией); второй — персональный цвет ника (rolePanel/
// colors.js). Панель ничего не создаёт сама для игровых ролей — только
// находит их по имени и хранит ID в rolePanel/config.js; роли-цвета
// создаёт сама (см. scripts/setup-role-panel.js).
//
// Раньше был и третий список — роли-пинги "хочу новости об этом" по
// тем же играм (создавал scripts/setup-game-news.js) — убран из панели
// по прямому запросу администратора (сам список игровых новостных
// каналов и пинг при публикации остаются, см. gameNews/), самообслуживание
// подписки через эту панель больше не нужно.
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { baseContainer, textDisplay, separator, toEphemeralMessage } = require('../utils/components');

const GAMES_SELECT_CUSTOM_ID = 'rolepanel_games_select';
const COLOR_SELECT_CUSTOM_ID = 'rolepanel_color_select';

// maxValues по умолчанию — "выбери сколько угодно из списка" (игры);
// цвет ника — ровно один, см. вызов ниже.
function buildSelectRow(customId, placeholder, games, { maxValues } = {}) {
    const options = games.map(game => ({ label: game.name, value: game.key, emoji: game.emoji }));
    const select = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .setMinValues(0)
        .setMaxValues(maxValues ?? Math.max(1, options.length))
        .addOptions(options);
    return new ActionRowBuilder().addComponents(select);
}

// Каждый выбор в одном из менюшек — это ПОЛНЫЙ желаемый набор ролей
// именно этой категории (Discord не поддерживает разные "выбрано по
// умолчанию" для разных людей на одном статичном сообщении), поэтому
// явно проговорено в тексте панели: неотмеченная игра из уже имеющихся
// ролей будет снята, а не просто "к списку добавятся новые". playGames —
// только те игры, чья роль реально нашлась на сервере (см.
// scripts/setup-role-panel.js) — пустой список просто не рисует свой
// ряд меню, вместо пункта, который ничего не сделает.
function buildPanelMessage({ playGames, colors = [] }) {
    const container = baseContainer(COLORS.primary).addTextDisplayComponents(
        textDisplay('### Выбери свой путь\n-# Отметь игры, в которые играешь — так тебя будет проще позвать в команду.')
    );
    if (playGames.length) {
        container.addActionRowComponents(buildSelectRow(GAMES_SELECT_CUSTOM_ID, 'Выбери свои игры', playGames));
    }

    if (colors.length) {
        container.addSeparatorComponents(separator());
        container.addTextDisplayComponents(
            textDisplay('### Цвет ника\n-# Выбери себе цвет ника — можно выбрать только один.')
        );
        container.addActionRowComponents(
            buildSelectRow(COLOR_SELECT_CUSTOM_ID, 'Выбери цвет', colors, { maxValues: 1 })
        );
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

// colors — та же форма, что и games ({key, name, emoji}), см.
// rolePanel/colors.js. Единственная реальная разница с играми — в самом
// меню (maxValues: 1, buildPanelMessage выше): applySelection и без этого
// корректно снимает прежний цвет и выдаёт новый, потому что interaction.
// values физически не может содержать больше одного значения.
async function handleColorSelect(interaction, roleIds, colors) {
    await applySelection(interaction, roleIds, colors, {
        reason: 'Панель выбора цвета ника',
        actionLabel: 'Цвет ника обновлён',
        emptyText: 'Цвет ника обновлён — цвет не выбран.',
    });
}

module.exports = {
    GAMES_SELECT_CUSTOM_ID,
    COLOR_SELECT_CUSTOM_ID,
    buildPanelMessage,
    computeRoleDiff,
    describeSelection,
    handleGamesSelect,
    handleColorSelect,
};
