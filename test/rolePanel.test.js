const test = require('node:test');
const assert = require('node:assert/strict');
const {
    computeRoleDiff,
    describeSelection,
    buildPanelMessage,
    GAMES_SELECT_CUSTOM_ID,
    NEWS_SELECT_CUSTOM_ID,
    handleGamesSelect,
    handleNewsSelect,
} = require('../rolePanel/model');
const handlers = require('../rolePanel/handlers');

const GAMES = [
    { key: 'valorant', name: 'Valorant', emoji: '🎯' },
    { key: 'cs2', name: 'CS2', emoji: '🔫' },
    { key: 'gta', name: 'GTA', emoji: '🚗' },
];
const ROLE_IDS = { valorant: 'role-valorant', cs2: 'role-cs2', gta: 'role-gta' };

// interaction.deferUpdate() + followUp() — не reply() (см. model.js
// applySelection: без deferUpdate() Discord-клиент продолжает
// показывать выбранные варианты отмеченными в самом меню).
function fakeInteraction({ values, currentRoleIds }) {
    const added = [];
    const removed = [];
    const deferred = { count: 0 };
    const followUps = [];
    return {
        values,
        member: {
            roles: {
                cache: new Map(currentRoleIds.map(id => [id, {}])),
                add: async id => added.push(id),
                remove: async id => removed.push(id),
            },
        },
        deferUpdate: async () => {
            deferred.count += 1;
        },
        followUp: async payload => followUps.push(payload),
        added,
        removed,
        deferred,
        followUps,
    };
}

test('computeRoleDiff: добавляет впервые выбранные, снимает отмеченные ранее, но не выбранные сейчас', () => {
    const { toAdd, toRemove } = computeRoleDiff(['valorant', 'gta'], ROLE_IDS, ['role-cs2']);
    assert.deepEqual(toAdd.sort(), ['role-gta', 'role-valorant']);
    assert.deepEqual(toRemove, ['role-cs2']);
});

test('computeRoleDiff: ничего не выбрано — снимает все отслеживаемые роли, которые были', () => {
    const { toAdd, toRemove } = computeRoleDiff([], ROLE_IDS, ['role-cs2', 'role-gta']);
    assert.deepEqual(toAdd, []);
    assert.deepEqual(toRemove.sort(), ['role-cs2', 'role-gta']);
});

test('computeRoleDiff: не трогает роли участника, не входящие в отслеживаемый набор', () => {
    const { toAdd, toRemove } = computeRoleDiff(['valorant'], ROLE_IDS, ['role-cs2', 'role-moderator']);
    assert.deepEqual(toAdd, ['role-valorant']);
    assert.deepEqual(toRemove, ['role-cs2']);
});

test('computeRoleDiff: уже выбранная и уже имеющаяся роль не попадает ни в toAdd, ни в toRemove', () => {
    const { toAdd, toRemove } = computeRoleDiff(['valorant'], ROLE_IDS, ['role-valorant']);
    assert.deepEqual(toAdd, []);
    assert.deepEqual(toRemove, []);
});

test('computeRoleDiff: игра без найденной роли просто игнорируется (roleIds не содержит ключ)', () => {
    const { toAdd, toRemove } = computeRoleDiff(['unknown-game'], ROLE_IDS, []);
    assert.deepEqual(toAdd, []);
    assert.deepEqual(toRemove, []);
});

test('describeSelection: перечисляет названия выбранных игр, null если ничего не выбрано', () => {
    assert.equal(describeSelection(['valorant', 'gta'], GAMES), 'Valorant, GTA');
    assert.equal(describeSelection([], GAMES), null);
});

test('buildPanelMessage: собирает оба StringSelectMenu, каждый с опцией на каждую игру своей категории', () => {
    const container = buildPanelMessage({ playGames: GAMES, newsGames: GAMES.slice(0, 2) });
    const json = container.toJSON();
    const actionRows = json.components.filter(c => c.type === 1);
    assert.equal(actionRows.length, 2);

    const playSelect = actionRows[0].components[0];
    assert.equal(playSelect.custom_id, GAMES_SELECT_CUSTOM_ID);
    assert.equal(playSelect.options.length, GAMES.length);
    assert.deepEqual(
        playSelect.options.map(o => o.value),
        GAMES.map(g => g.key)
    );
    assert.equal(playSelect.min_values, 0);

    const newsSelect = actionRows[1].components[0];
    assert.equal(newsSelect.custom_id, NEWS_SELECT_CUSTOM_ID);
    assert.equal(newsSelect.options.length, 2);
});

test('buildPanelMessage: пустая категория не рисует свой ряд меню', () => {
    const container = buildPanelMessage({ playGames: GAMES, newsGames: [] });
    const json = container.toJSON();
    const actionRows = json.components.filter(c => c.type === 1);
    assert.equal(actionRows.length, 1);
    assert.equal(actionRows[0].components[0].custom_id, GAMES_SELECT_CUSTOM_ID);
});

test('handleGamesSelect: применяет диф к ролям участника, deferUpdate()+followUp() с итогом', async () => {
    const interaction = fakeInteraction({ values: ['valorant'], currentRoleIds: ['role-cs2'] });

    await handleGamesSelect(interaction, ROLE_IDS, GAMES);

    assert.deepEqual(interaction.added, ['role-valorant']);
    assert.deepEqual(interaction.removed, ['role-cs2']);
    assert.equal(interaction.deferred.count, 1);
    assert.equal(interaction.followUps.length, 1);
    assert.match(JSON.stringify(interaction.followUps[0]), /Valorant/);
});

test('handleGamesSelect: пустой выбор отвечает текстом про снятие всех ролей', async () => {
    const interaction = fakeInteraction({ values: [], currentRoleIds: ['role-valorant'] });

    await handleGamesSelect(interaction, ROLE_IDS, GAMES);

    assert.match(JSON.stringify(interaction.followUps[0]), /ни одна игра не выбрана/);
});

test('handleNewsSelect: свой текст и своя причина в audit-логе, независим от игровых ролей', async () => {
    const interaction = fakeInteraction({ values: ['cs2'], currentRoleIds: [] });

    await handleNewsSelect(interaction, ROLE_IDS, GAMES);

    assert.deepEqual(interaction.added, ['role-cs2']);
    assert.match(JSON.stringify(interaction.followUps[0]), /Подписки на новости обновлены.*CS2/);
});

test('handlers.handleSelectMenu: чужой customId — false без похода в БД', async () => {
    const result = await handlers.handleSelectMenu({ customId: 'not_rolepanel' });
    assert.equal(result, false);
});
