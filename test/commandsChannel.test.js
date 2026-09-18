const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowed } = require('../commandsChannel');

test('isAllowed: канал не ограничен, если channelId не настроен', () => {
    assert.equal(isAllowed(null, 'any-channel'), true);
});

test('isAllowed: разрешён только настроенный канал, если он задан', () => {
    assert.equal(isAllowed('commands-channel', 'commands-channel'), true);
    assert.equal(isAllowed('commands-channel', 'other-channel'), false);
});
