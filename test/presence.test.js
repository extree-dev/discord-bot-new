const test = require('node:test');
const assert = require('node:assert/strict');
const { formatUptime } = require('../presence/model');

test('formatUptime форматирует миллисекунды аптайма в человекочитаемый вид', () => {
    assert.equal(formatUptime(0), '0м');
    assert.equal(formatUptime(65 * 60 * 1000), '1ч 5м');
    assert.equal(formatUptime((25 * 60 + 5) * 60 * 1000), '1д 1ч 5м');
    assert.equal(formatUptime(45 * 60 * 1000), '45м');
});
