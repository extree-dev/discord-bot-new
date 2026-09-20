const test = require('node:test');
const assert = require('node:assert/strict');
const { findExpiredMutes } = require('../moderation/model');

test('findExpiredMutes: находит только записи с истёкшим expiresAt, парсит guildId/userId из ключа', () => {
    const now = 1_000_000;
    const data = {
        guild1_user1: { expiresAt: now - 1_000, reason: 'спам' },
        guild1_user2: { expiresAt: now + 1_000, reason: 'спам' },
        guild2_user3: { expiresAt: now, reason: 'токсичность' },
    };

    const result = findExpiredMutes(data, now);
    assert.equal(result.length, 2);

    const byUser = Object.fromEntries(result.map(r => [r.userId, r]));
    assert.equal(byUser.user1.guildId, 'guild1');
    assert.equal(byUser.user1.entry.reason, 'спам');
    assert.equal(byUser.user3.guildId, 'guild2');
    assert.ok(!byUser.user2, 'ещё не истёкшая запись не должна попасть в результат');
});

test('findExpiredMutes: пустой стор — пустой результат', () => {
    assert.deepEqual(findExpiredMutes({}, Date.now()), []);
});
