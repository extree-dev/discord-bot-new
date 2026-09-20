const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');
const { toMessage, toEphemeralMessage } = require('../utils/components');

test('toMessage: флаг только IsComponentsV2, без Ephemeral', () => {
    const payload = toMessage();
    assert.equal(payload.flags, MessageFlags.IsComponentsV2);
    assert.equal(payload.flags & MessageFlags.Ephemeral, 0);
});

test('toEphemeralMessage: несёт оба флага — IsComponentsV2 и Ephemeral', () => {
    const payload = toEphemeralMessage();
    assert.notEqual(payload.flags & MessageFlags.IsComponentsV2, 0);
    assert.notEqual(payload.flags & MessageFlags.Ephemeral, 0);
});

test('toMessage/toEphemeralMessage: передают компоненты как есть', () => {
    const fake = { id: 'fake-component' };
    assert.deepEqual(toMessage(fake).components, [fake]);
    assert.deepEqual(toEphemeralMessage(fake).components, [fake]);
});
