const test = require('node:test');
const assert = require('node:assert/strict');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { renderLeaderboardCard, WIDTH } = require('../leveling/leaderboardImage');

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

async function getPixel(png, x, y) {
    const image = await loadImage(png);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(x, y, 1, 1);
    return { r: data[0], g: data[1], b: data[2] };
}

test('renderLeaderboardCard: пустой топ не падает и не рисует строки', async () => {
    const png = await renderLeaderboardCard({ title: 'Топ активности', entries: [] });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: несколько записей без movement (разовый /level leaderboard) не падает', async () => {
    const entries = [
        { rank: 1, userId: 'a', displayName: 'Первый', avatarBuffer: fakeImageBuffer(), score: 420, messageCount: 60 },
        { rank: 2, userId: 'b', displayName: 'Второй', avatarBuffer: null, score: 300, messageCount: 40 },
        { rank: 3, userId: 'c', displayName: 'Третий', avatarBuffer: fakeImageBuffer(), score: 120, messageCount: 20 },
    ];
    const png = await renderLeaderboardCard({ title: 'Топ активности', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: все варианты movement (+/-/=/новый) не падают', async () => {
    const entries = [
        {
            rank: 1,
            userId: 'a',
            displayName: 'Растёт',
            avatarBuffer: null,
            score: 420,
            messageCount: 60,
            movement: '+2',
        },
        {
            rank: 2,
            userId: 'b',
            displayName: 'Падает',
            avatarBuffer: null,
            score: 300,
            messageCount: 40,
            movement: '-1',
        },
        {
            rank: 3,
            userId: 'c',
            displayName: 'Стабильно',
            avatarBuffer: null,
            score: 120,
            messageCount: 20,
            movement: '=',
        },
        {
            rank: 4,
            userId: 'd',
            displayName: 'Новенький',
            avatarBuffer: null,
            score: 50,
            messageCount: 5,
            movement: 'новый',
        },
    ];
    const png = await renderLeaderboardCard({ title: 'Топ активности за неделю', entries });
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
            messageCount: 0,
        },
    ];
    const png = await renderLeaderboardCard({ title: 'Топ активности', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: топ-3 с уровнем и статистикой сообщений не падает', async () => {
    const level = { title: 'Легенда сервера', min: 7000, color: 0xe91e63, next: null, progress: 1 };
    const entries = [
        {
            rank: 1,
            userId: 'a',
            displayName: 'Первый',
            avatarBuffer: fakeImageBuffer(),
            score: 9000,
            messageCount: 900,
            level,
        },
        { rank: 2, userId: 'b', displayName: 'Второй', avatarBuffer: null, score: 8500, messageCount: 800, level },
        {
            rank: 3,
            userId: 'c',
            displayName: 'Третий',
            avatarBuffer: fakeImageBuffer(),
            score: 8000,
            messageCount: 700,
            level,
        },
    ];
    const png = await renderLeaderboardCard({ title: 'Топ активности', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: только один участник в топе не падает', async () => {
    const entries = [
        { rank: 1, userId: 'a', displayName: 'Одинокий лидер', avatarBuffer: null, score: 5, messageCount: 1 },
    ];
    const png = await renderLeaderboardCard({ title: 'Топ активности', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: только места 4+ (без топ-3) не падает', async () => {
    const entries = [
        { rank: 4, userId: 'a', displayName: 'Четвёртый', avatarBuffer: null, score: 100, messageCount: 10 },
        { rank: 5, userId: 'b', displayName: 'Пятый', avatarBuffer: null, score: 80, messageCount: 8 },
    ];
    const png = await renderLeaderboardCard({ title: 'Топ активности', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderLeaderboardCard: высота растёт линейно с числом записей (все строки одной высоты)', async () => {
    const makeEntries = n =>
        Array.from({ length: n }, (_, i) => ({
            rank: i + 1,
            userId: `u${i}`,
            displayName: `Игрок ${i}`,
            avatarBuffer: null,
            score: 100 - i,
            messageCount: 10 - i,
        }));

    const sizes = await Promise.all(
        [3, 5, 10].map(n => renderLeaderboardCard({ title: 'Топ', entries: makeEntries(n) }).then(getPngSize))
    );

    for (const size of sizes) assert.equal(size.width, WIDTH);
    // Одинаковая высота строки для любого места — разница между 3 и 5
    // записями (2 строки) должна совпадать с разницей между 5 и 10 (5
    // строк) в пересчёте на одну строку. Топ-3 больше не крупнее остальных.
    const perRow3to5 = (sizes[1].height - sizes[0].height) / 2;
    const perRow5to10 = (sizes[2].height - sizes[1].height) / 5;
    assert.equal(perRow3to5, perRow5to10);
});

test('renderLeaderboardCard: полоса прогресса красится в level.color независимо от места', async () => {
    const level = {
        title: 'Участник',
        min: 100,
        color: 0x2ecc71,
        next: { title: 'Активный участник', min: 400 },
        progress: 0.5,
    };
    const entries = [
        { rank: 1, userId: 'a', displayName: 'Первый', avatarBuffer: null, score: 250, messageCount: 0, level },
    ];
    const png = await renderLeaderboardCard({ title: 'Топ', entries });
    // Точка внутри залитой части полосы первой (единственной) строки.
    const pixel = await getPixel(png, 150, 135);
    assert.equal(pixel.r, 46);
    assert.equal(pixel.g, 204);
    assert.equal(pixel.b, 113);
});

test('WIDTH экспортирован и положителен', () => {
    assert.ok(WIDTH > 0);
});

test('renderLeaderboardCard: запись с prestige не падает', async () => {
    const entries = [
        {
            rank: 1,
            userId: 'a',
            displayName: 'Престижный',
            avatarBuffer: null,
            score: 100,
            messageCount: 10,
            prestige: 2,
            level: { title: 'Новичок', number: 0, progress: 0 },
        },
    ];
    const png = await renderLeaderboardCard({ title: 'Топ', entries });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});
