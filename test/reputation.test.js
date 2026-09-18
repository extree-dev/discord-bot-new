const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getLevelIndex,
    getLevel,
    computeCooldownRemaining,
    countRecentGivenTo,
    buildLeaderboardMovement,
    formatRemaining,
} = require('../reputation/model');

test('getLevelIndex возвращает индекс последнего пройденного порога', () => {
    assert.equal(getLevelIndex(0), 0);
    assert.equal(getLevelIndex(4), 0);
    assert.equal(getLevelIndex(5), 1);
    assert.equal(getLevelIndex(14), 1);
    assert.equal(getLevelIndex(200), 6);
    assert.equal(getLevelIndex(999), 6);
});

test('getLevel считает прогресс до следующего уровня, на максимуме — 1 и next=null', () => {
    const mid = getLevel(10); // между "Участник" (5) и "Активный участник" (15)
    assert.equal(mid.title, 'Участник');
    assert.equal(mid.next.title, 'Активный участник');
    assert.equal(mid.progress, 0.5);

    const max = getLevel(500);
    assert.equal(max.title, 'Икона сообщества');
    assert.equal(max.next, null);
    assert.equal(max.progress, 1);
});

test('computeCooldownRemaining: 0 без предыдущей выдачи, иначе остаток окна', () => {
    const cooldownMs = 1000;
    assert.equal(computeCooldownRemaining(null, 5000, cooldownMs), 0);
    assert.equal(computeCooldownRemaining(4500, 5000, cooldownMs), 500);
    assert.equal(computeCooldownRemaining(3000, 5000, cooldownMs), 0); // окно уже прошло
});

test('countRecentGivenTo считает только метки времени внутри окна', () => {
    const now = 100000;
    const givenTo = {
        a: now - 1000, // внутри 24ч
        b: now - 23 * 60 * 60 * 1000, // внутри
        c: now - 25 * 60 * 60 * 1000, // уже вне окна
    };
    assert.equal(countRecentGivenTo(givenTo, now), 2);
    assert.equal(countRecentGivenTo({}, now), 0);
    assert.equal(countRecentGivenTo(undefined, now), 0);
});

test('buildLeaderboardMovement сравнивает ранги с прошлым снимком', () => {
    const previous = [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }];
    const current = [
        { userId: 'b', score: 10 }, // был #2, теперь #1 → +1
        { userId: 'a', score: 8 }, // был #1, теперь #2 → -1
        { userId: 'd', score: 5 }, // не было в прошлом снимке → новый
    ];
    const result = buildLeaderboardMovement(current, previous);
    assert.deepEqual(
        result.map(e => e.movement),
        ['+1', '-1', 'новый']
    );
    assert.deepEqual(
        result.map(e => e.rank),
        [1, 2, 3]
    );
});

test('buildLeaderboardMovement: без предыдущего снимка все "новый"', () => {
    const result = buildLeaderboardMovement([{ userId: 'a', score: 1 }], undefined);
    assert.equal(result[0].movement, 'новый');
});

test('buildLeaderboardMovement: одинаковая позиция даёт "="', () => {
    const previous = [{ userId: 'a' }];
    const result = buildLeaderboardMovement([{ userId: 'a', score: 5 }], previous);
    assert.equal(result[0].movement, '=');
});

test('formatRemaining форматирует миллисекунды в часы/минуты', () => {
    assert.equal(formatRemaining(60 * 1000), '1 мин');
    assert.equal(formatRemaining(90 * 60 * 1000), '1 ч 30 мин');
    assert.equal(formatRemaining(2 * 60 * 60 * 1000), '2 ч 0 мин');
});
