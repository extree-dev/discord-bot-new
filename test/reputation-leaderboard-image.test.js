const test = require('node:test');
const assert = require('node:assert/strict');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { renderLeaderboardCard, WIDTH } = require('../reputation/leaderboardImage');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fakeImageBuffer(size = 64) {
    const canvas = createCanvas(size, size);
    canvas.getContext('2d').fillRect(0, 0, size, size);
    return canvas.toBuffer('image/png');
}

async function getPngSize(png) {
    const image = await loadImage(png);
    return { width: image.width, height: image.height };
}

test('renderLeaderboardCard: пустой рейтинг не падает и не рисует строки', async () => {
    const png = await renderLeaderboardCard({ title: 'Рейтинг репутации', entries: [] });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: несколько записей без movement (разовый /rep leaderboard) не падает', async () => {
    const entries = [
        { rank: 1, userId: 'a', displayName: 'Первый', avatarBuffer: fakeImageBuffer(), score: 42 },
        { rank: 2, userId: 'b', displayName: 'Второй', avatarBuffer: null, score: 30 },
        { rank: 3, userId: 'c', displayName: 'Третий', avatarBuffer: fakeImageBuffer(), score: 12 },
    ];
    const png = await renderLeaderboardCard({ title: 'Рейтинг репутации', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: все варианты movement (+/-/=/новый) не падают', async () => {
    const entries = [
        { rank: 1, userId: 'a', displayName: 'Растёт', avatarBuffer: null, score: 42, movement: '+2' },
        { rank: 2, userId: 'b', displayName: 'Падает', avatarBuffer: null, score: 30, movement: '-1' },
        { rank: 3, userId: 'c', displayName: 'Стабильно', avatarBuffer: null, score: 12, movement: '=' },
        { rank: 4, userId: 'd', displayName: 'Новенький', avatarBuffer: null, score: 5, movement: 'новый' },
    ];
    const png = await renderLeaderboardCard({ title: 'Рейтинг репутации за неделю', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: длинное имя обрезается, не падает', async () => {
    const entries = [
        {
            rank: 1,
            userId: 'a',
            displayName: 'Очень длинное отображаемое имя участника сервера для проверки обрезки',
            avatarBuffer: null,
            score: 1,
        },
    ];
    const png = await renderLeaderboardCard({ title: 'Рейтинг репутации', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: подиум топ-3 с уровнем и выданной репутацией не падает', async () => {
    const level = { title: 'Легенда сервера', min: 100, color: 0xe91e63, next: null, progress: 1 };
    const entries = [
        {
            rank: 1,
            userId: 'a',
            displayName: 'Первый',
            avatarBuffer: fakeImageBuffer(),
            score: 220,
            givenCount: 15,
            level,
        },
        { rank: 2, userId: 'b', displayName: 'Второй', avatarBuffer: null, score: 180, givenCount: 10, level },
        {
            rank: 3,
            userId: 'c',
            displayName: 'Третий',
            avatarBuffer: fakeImageBuffer(),
            score: 140,
            givenCount: 5,
            level,
        },
    ];
    const png = await renderLeaderboardCard({ title: 'Рейтинг репутации', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: только один участник (топ-1, без #2/#3) не падает', async () => {
    const entries = [{ rank: 1, userId: 'a', displayName: 'Одинокий лидер', avatarBuffer: null, score: 5 }];
    const png = await renderLeaderboardCard({ title: 'Рейтинг репутации', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: список без подиума (только места 4+) не падает', async () => {
    const entries = [
        { rank: 4, userId: 'a', displayName: 'Четвёртый', avatarBuffer: null, score: 10, givenCount: 1 },
        { rank: 5, userId: 'b', displayName: 'Пятый', avatarBuffer: null, score: 8, givenCount: 0 },
    ];
    const png = await renderLeaderboardCard({ title: 'Рейтинг репутации', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: длинное имя в списке (не на подиуме) обрезается, не падает', async () => {
    const entries = [
        {
            rank: 4,
            userId: 'a',
            displayName: 'Очень длинное отображаемое имя участника сервера для проверки обрезки',
            avatarBuffer: null,
            score: 1,
            givenCount: 0,
        },
    ];
    const png = await renderLeaderboardCard({ title: 'Рейтинг репутации', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: высота растёт с числом записей, ширина неизменна', async () => {
    const makeEntries = n =>
        Array.from({ length: n }, (_, i) => ({
            rank: i + 1,
            userId: `u${i}`,
            displayName: `Игрок ${i}`,
            avatarBuffer: null,
            score: 10 - i,
        }));

    const small = await getPngSize(await renderLeaderboardCard({ title: 'Топ', entries: makeEntries(3) }));
    const big = await getPngSize(await renderLeaderboardCard({ title: 'Топ', entries: makeEntries(10) }));

    assert.equal(small.width, WIDTH);
    assert.equal(big.width, WIDTH);
    assert.ok(big.height > small.height);
});

test('WIDTH экспортирован и положителен', () => {
    assert.ok(WIDTH > 0);
});
