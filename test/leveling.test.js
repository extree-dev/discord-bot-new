const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getLevelIndex,
    getLevel,
    canCountMessage,
    MESSAGE_COOLDOWN_MS,
    buildLeaderboardMovement,
    buildRankCardAttachment,
    buildLeaderboardAttachment,
} = require('../leveling/model');

// Discord CDN принимает только эти размеры — любое другое значение роняет
// bannerURL()/displayAvatarURL() RangeError'ом (см. CHANGELOG 3.9.2: size:
// 600 валил всю команду профиля, как только у пользователя оказывался
// баннер — тот же риск унаследован leveling/ от прежней системы репутации).
const VALID_CDN_SIZES = new Set([16, 32, 64, 128, 256, 512, 1024, 2048, 4096]);

test('getLevelIndex возвращает индекс последнего пройденного порога', () => {
    assert.equal(getLevelIndex(0), 0);
    assert.equal(getLevelIndex(99), 0);
    assert.equal(getLevelIndex(100), 1);
    assert.equal(getLevelIndex(399), 1);
    assert.equal(getLevelIndex(15000), 6);
    assert.equal(getLevelIndex(99999), 6);
});

test('getLevel считает прогресс до следующего уровня, на максимуме — 1 и next=null', () => {
    const mid = getLevel(250); // между "Участник" (100) и "Активный участник" (400)
    assert.equal(mid.title, 'Участник');
    assert.equal(mid.next.title, 'Активный участник');
    assert.equal(mid.progress, 0.5);

    const max = getLevel(20000);
    assert.equal(max.title, 'Икона сообщества');
    assert.equal(max.next, null);
    assert.equal(max.progress, 1);
});

test('canCountMessage: кулдаун действует только на пару гильдия+пользователь', () => {
    const now = 1_000_000;
    assert.equal(canCountMessage('g1', 'u1', now), true);
    assert.equal(canCountMessage('g1', 'u1', now + 1000), false); // тот же — кулдаун не прошёл
    assert.equal(canCountMessage('g1', 'u1', now + MESSAGE_COOLDOWN_MS), true); // кулдаун прошёл
    assert.equal(canCountMessage('g1', 'u2', now + 1000), true); // другой пользователь — свой кулдаун
    assert.equal(canCountMessage('g2', 'u1', now + 1000), true); // другая гильдия — свой кулдаун
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

test('buildRankCardAttachment: запрашивает аватар, баннер и иконку сервера только валидными размерами CDN', async () => {
    const fakeUser = {
        globalName: 'Тест',
        username: 'test',
        displayAvatarURL: (options = {}) => {
            assert.ok(VALID_CDN_SIZES.has(options.size), `displayAvatarURL: невалидный size ${options.size}`);
            return null;
        },
        bannerURL: (options = {}) => {
            assert.ok(VALID_CDN_SIZES.has(options.size), `bannerURL: невалидный size ${options.size}`);
            return null;
        },
    };
    const fakeClient = { users: { fetch: async () => fakeUser } };
    const fakeGuild = {
        name: 'Тестовый сервер',
        iconURL: (options = {}) => {
            assert.ok(VALID_CDN_SIZES.has(options.size), `iconURL: невалидный size ${options.size}`);
            return null;
        },
    };
    const level = {
        title: 'Участник',
        min: 100,
        color: 0x2ecc71,
        next: { title: 'Активный участник', min: 400 },
        progress: 0.5,
    };

    const attachment = await buildRankCardAttachment(
        fakeClient,
        'user-1',
        { score: 250, level, rank: 3, messageCount: 40, voiceMinutes: 120 },
        fakeGuild
    );

    assert.ok(attachment);
});

test('buildRankCardAttachment: работает и без гильдии (guild не передан)', async () => {
    const fakeUser = {
        globalName: 'Тест',
        username: 'test',
        displayAvatarURL: () => null,
        bannerURL: () => null,
    };
    const fakeClient = { users: { fetch: async () => fakeUser } };
    const level = { title: 'Новичок', min: 0, color: 0x99aab5, next: { title: 'Участник', min: 100 }, progress: 0 };

    const attachment = await buildRankCardAttachment(fakeClient, 'user-1', {
        score: 0,
        level,
        rank: null,
        messageCount: 0,
        voiceMinutes: 0,
    });

    assert.ok(attachment);
});

test('getLevel возвращает числовой color для каждого уровня', () => {
    for (const score of [0, 100, 400, 1200, 3000, 7000, 15000, 99999]) {
        assert.equal(typeof getLevel(score).color, 'number');
    }
});

test('buildLeaderboardAttachment: запрашивает аватар каждого участника только валидным размером CDN', async () => {
    const fakeUsers = {
        a: { globalName: 'Первый', displayAvatarURL: opts => checkSize(opts) },
        b: { globalName: 'Второй', displayAvatarURL: opts => checkSize(opts) },
    };
    function checkSize(options = {}) {
        assert.ok(VALID_CDN_SIZES.has(options.size), `displayAvatarURL: невалидный size ${options.size}`);
        return null;
    }
    const fakeClient = { users: { fetch: async id => fakeUsers[id] ?? null } };
    const entries = [
        { rank: 1, userId: 'a', score: 300, messageCount: 30 },
        { rank: 2, userId: 'b', score: 120, messageCount: 12 },
    ];

    const attachment = await buildLeaderboardAttachment(fakeClient, entries);

    assert.ok(attachment);
});

test('buildLeaderboardAttachment: пустой список не падает', async () => {
    const fakeClient = { users: { fetch: async () => null } };
    const attachment = await buildLeaderboardAttachment(fakeClient, []);
    assert.ok(attachment);
});
