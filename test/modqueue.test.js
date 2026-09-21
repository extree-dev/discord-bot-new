const test = require('node:test');
const assert = require('node:assert/strict');
const { isModerated, addModeratedChannel, removeModeratedChannel, buildOutcomeCard } = require('../modqueue/model');

test('isModerated: true только для каналов из списка', () => {
    assert.equal(isModerated(['a', 'b'], 'a'), true);
    assert.equal(isModerated(['a', 'b'], 'c'), false);
    assert.equal(isModerated([], 'a'), false);
});

test('addModeratedChannel: добавляет канал, не дублирует уже добавленный', () => {
    assert.deepEqual(addModeratedChannel([], 'a'), ['a']);
    assert.deepEqual(addModeratedChannel(['a'], 'b'), ['a', 'b']);
    assert.deepEqual(addModeratedChannel(['a', 'b'], 'a'), ['a', 'b']); // уже есть — без дубля
});

test('removeModeratedChannel: убирает канал, не падает если его и не было', () => {
    assert.deepEqual(removeModeratedChannel(['a', 'b'], 'a'), ['b']);
    assert.deepEqual(removeModeratedChannel(['a'], 'z'), ['a']);
    assert.deepEqual(removeModeratedChannel([], 'a'), []);
});

test('buildOutcomeCard: строит карточку для одобрено/отклонено/истекло, не падает', () => {
    const approved = buildOutcomeCard('approved', { authorId: 'u1', moderator: '<@u2>' });
    const rejected = buildOutcomeCard('rejected', { authorId: 'u1', moderator: '<@u2>' });
    const expired = buildOutcomeCard('expired', {});
    assert.ok(approved);
    assert.ok(rejected);
    assert.ok(expired);
});
