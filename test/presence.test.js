const test = require('node:test');
const assert = require('node:assert/strict');
const { formatUptime, isValidStreamUrl } = require('../presence/model');

test('formatUptime форматирует миллисекунды аптайма в человекочитаемый вид', () => {
    assert.equal(formatUptime(0), '0м');
    assert.equal(formatUptime(65 * 60 * 1000), '1ч 5м');
    assert.equal(formatUptime((25 * 60 + 5) * 60 * 1000), '1д 1ч 5м');
    assert.equal(formatUptime(45 * 60 * 1000), '45м');
});

test('isValidStreamUrl принимает ссылки на Twitch и YouTube, отклоняет остальные', () => {
    assert.equal(isValidStreamUrl('https://twitch.tv/extree'), true);
    assert.equal(isValidStreamUrl('https://www.twitch.tv/extree'), true);
    assert.equal(isValidStreamUrl('https://youtube.com/watch?v=abc123'), true);
    assert.equal(isValidStreamUrl('https://youtu.be/abc123'), true);
    assert.equal(isValidStreamUrl('https://youtube.com/extree'), false);
    assert.equal(isValidStreamUrl('http://example.com'), false);
    assert.equal(isValidStreamUrl(null), false);
    assert.equal(isValidStreamUrl(undefined), false);
    assert.equal(isValidStreamUrl(''), false);
});
