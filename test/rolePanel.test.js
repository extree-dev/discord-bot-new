const test = require('node:test');
const assert = require('node:assert/strict');
const {
    computeRoleDiff,
    describeSelection,
    buildPanelMessage,
    SELECT_CUSTOM_ID,
    handleGamesSelect,
} = require('../rolePanel/model');
const handlers = require('../rolePanel/handlers');

const GAMES = [
    { key: 'valorant', name: 'Valorant', emoji: '🎯' },
    { key: 'cs2', name: 'CS2', emoji: '🔫' },
    { key: 'gta', name: 'GTA', emoji: '🚗' },
];
const ROLE_IDS = { valorant: 'role-valorant', cs2: 'role-cs2', gta: 'role-gta' };

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

test('buildPanelMessage: собирает StringSelectMenu с опцией на каждую игру', () => {
    const container = buildPanelMessage(GAMES);
    const json = container.toJSON();
    const actionRow = json.components.find(c => c.type === 1);
    const select = actionRow.components[0];
    assert.equal(select.custom_id, SELECT_CUSTOM_ID);
    assert.equal(select.options.length, GAMES.length);
    assert.deepEqual(
        select.options.map(o => o.value),
        GAMES.map(g => g.key)
    );
    assert.equal(select.min_values, 0);
});

test('handleGamesSelect: применяет диф к ролям участника и отвечает эфемерным сообщением с итогом', async () => {
    const added = [];
    const removed = [];
    const replies = [];
    const interaction = {
        values: ['valorant'],
        member: {
            roles: {
                cache: new Map([['role-cs2', {}]]),
                add: async id => added.push(id),
                remove: async id => removed.push(id),
            },
        },
        reply: async payload => replies.push(payload),
    };

    await handleGamesSelect(interaction, ROLE_IDS, GAMES);

    assert.deepEqual(added, ['role-valorant']);
    assert.deepEqual(removed, ['role-cs2']);
    assert.equal(replies.length, 1);
    const text = JSON.stringify(replies[0]);
    assert.match(text, /Valorant/);
});

test('handleGamesSelect: пустой выбор отвечает текстом про снятие всех ролей', async () => {
    const replies = [];
    const interaction = {
        values: [],
        member: {
            roles: {
                cache: new Map([['role-valorant', {}]]),
                add: async () => {},
                remove: async () => {},
            },
        },
        reply: async payload => replies.push(payload),
    };

    await handleGamesSelect(interaction, ROLE_IDS, GAMES);

    const text = JSON.stringify(replies[0]);
    assert.match(text, /ни одна игра не выбрана/);
});

test('handlers.handleSelectMenu: чужой customId — false без похода в БД', async () => {
    const result = await handlers.handleSelectMenu({ customId: 'not_rolepanel' });
    assert.equal(result, false);
});
