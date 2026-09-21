const test = require('node:test');
const assert = require('node:assert/strict');
const { findExpiredNoticeThreads } = require('../utils/punishmentNotice');

test('findExpiredNoticeThreads: находит только треды с истёкшим deleteAt', () => {
    const now = 1_000_000;
    const data = {
        threads: {
            expired: { guildId: 'guild-1', deleteAt: now - 1_000 },
            exactlyNow: { guildId: 'guild-1', deleteAt: now },
            notYet: { guildId: 'guild-2', deleteAt: now + 1_000 },
        },
    };
    const result = findExpiredNoticeThreads(data, now);
    assert.equal(result.length, 2);
    assert.deepEqual(result.map(r => r.threadId).sort(), ['exactlyNow', 'expired']);
    assert.equal(result.find(r => r.threadId === 'expired').guildId, 'guild-1');
});

test('findExpiredNoticeThreads: пустой стор — пустой результат', () => {
    assert.deepEqual(findExpiredNoticeThreads({}, Date.now()), []);
    assert.deepEqual(findExpiredNoticeThreads({ threads: {} }, Date.now()), []);
});
