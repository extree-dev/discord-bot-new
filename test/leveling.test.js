const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const {
    LEVELS,
    POINTS_PER_LEVEL,
    getLevelNumber,
    getLevelIndex,
    getLevel,
    canCountMessage,
    MESSAGE_COOLDOWN_MS,
    buildLeaderboardMovement,
    getBoosterBundlePermissions,
    buildRankCardAttachment,
    buildLeaderboardAttachment,
} = require('../leveling/model');

// Discord CDN принимает только эти размеры — любое другое значение роняет
// bannerURL()/displayAvatarURL() RangeError'ом (см. CHANGELOG 3.9.2: size:
// 600 валил всю команду профиля, как только у пользователя оказывался
// баннер — тот же риск унаследован leveling/ от прежней системы репутации).
const VALID_CDN_SIZES = new Set([16, 32, 64, 128, 256, 512, 1024, 2048, 4096]);

test('getLevelNumber: floor(score / POINTS_PER_LEVEL), не уходит в минус', () => {
    assert.equal(getLevelNumber(0), 0);
    assert.equal(getLevelNumber(POINTS_PER_LEVEL - 1), 0);
    assert.equal(getLevelNumber(POINTS_PER_LEVEL), 1);
    assert.equal(getLevelNumber(POINTS_PER_LEVEL * 10), 10);
    assert.equal(getLevelNumber(-100), 0);
});

test('getLevelIndex возвращает индекс последнего пройденного яруса (по уровню, не по очкам)', () => {
    assert.equal(getLevelIndex(0), 0); // Новичок
    assert.equal(getLevelIndex(POINTS_PER_LEVEL * 5 - 1), 0); // ещё не 5 уровень
    assert.equal(getLevelIndex(POINTS_PER_LEVEL * 5), 1); // Путник
    assert.equal(getLevelIndex(POINTS_PER_LEVEL * 15), 2); // Рекрут
    assert.equal(getLevelIndex(POINTS_PER_LEVEL * 30), 3); // Боец
    assert.equal(getLevelIndex(POINTS_PER_LEVEL * 50), 4); // Специалист
    assert.equal(getLevelIndex(POINTS_PER_LEVEL * 75), 5); // Мастер
    assert.equal(getLevelIndex(POINTS_PER_LEVEL * 100), 6); // Хранитель
    assert.equal(getLevelIndex(POINTS_PER_LEVEL * 100 * 10), 6); // выше максимального яруса — тот же индекс
});

test('getLevel считает прогресс до следующего яруса по очкам, на максимуме — 1 и next=null', () => {
    const mid = getLevel(POINTS_PER_LEVEL * 10); // между "Путник" (5) и "Рекрут" (15), ровно посередине
    assert.equal(mid.title, 'Путник');
    assert.equal(mid.next.title, 'Рекрут');
    assert.equal(mid.progress, 0.5);
    assert.equal(mid.number, 10);

    const max = getLevel(POINTS_PER_LEVEL * 150);
    assert.equal(max.title, 'Хранитель');
    assert.equal(max.next, null);
    assert.equal(max.progress, 1);
    assert.equal(max.number, 150); // уровень растёт и после потолка последнего яруса
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
        title: 'Путник',
        min: 5,
        color: 0x2ecc71,
        next: { title: 'Рекрут', min: 15 },
        progress: 0.5,
        number: 10,
    };

    const attachment = await buildRankCardAttachment(
        fakeClient,
        'user-1',
        { score: 3000, level, rank: 3, messageCount: 40, voiceMinutes: 120 },
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
    const level = {
        title: 'Новичок',
        min: 0,
        color: 0x99aab5,
        next: { title: 'Путник', min: 5 },
        progress: 0,
        number: 0,
    };

    const attachment = await buildRankCardAttachment(fakeClient, 'user-1', {
        score: 0,
        level,
        rank: null,
        messageCount: 0,
        voiceMinutes: 0,
    });

    assert.ok(attachment);
});

test('getLevel возвращает числовой color для каждого яруса', () => {
    for (const level of [0, 5, 15, 30, 50, 75, 100, 500]) {
        assert.equal(typeof getLevel(level * POINTS_PER_LEVEL).color, 'number');
    }
});

test('LEVELS: у каждого яруса есть массив perks (пустой или с правами)', () => {
    for (const level of LEVELS) {
        assert.ok(Array.isArray(level.perks));
    }
});

test('LEVELS: перки нарастают по назначению — Путник даёт Stream, Специалист — внешние эмодзи/стикеры', () => {
    const путник = LEVELS.find(l => l.title === 'Путник');
    const специалист = LEVELS.find(l => l.title === 'Специалист');
    assert.ok(путник.perks.includes(PermissionFlagsBits.Stream));
    assert.ok(специалист.perks.includes(PermissionFlagsBits.UseExternalEmojis));
    assert.ok(специалист.perks.includes(PermissionFlagsBits.UseExternalStickers));
});

test('getBoosterBundlePermissions: объединяет перки ярусов 5-50 без дублей', () => {
    const perks = getBoosterBundlePermissions();
    assert.ok(perks.includes(PermissionFlagsBits.Stream)); // от Путника
    assert.ok(perks.includes(PermissionFlagsBits.AttachFiles)); // от Рекрута
    assert.ok(perks.includes(PermissionFlagsBits.AddReactions)); // от Бойца
    assert.ok(perks.includes(PermissionFlagsBits.UseExternalEmojis)); // от Специалиста
    assert.equal(perks.length, new Set(perks).size); // без дублей
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
