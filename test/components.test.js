const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageFlags } = require('discord.js');
const { toMessage, toEphemeralMessage, withEphemeral } = require('../utils/components');

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

test('withEphemeral: добавляет флаг Ephemeral к готовому payload и сохраняет остальные поля (например files)', () => {
    const files = [{ name: 'fake.png' }];
    const message = withEphemeral({ flags: MessageFlags.IsComponentsV2, components: ['c'], files });
    assert.notEqual(message.flags & MessageFlags.IsComponentsV2, 0);
    assert.notEqual(message.flags & MessageFlags.Ephemeral, 0);
    assert.equal(message.files, files);
});
