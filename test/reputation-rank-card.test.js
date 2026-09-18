const test = require('node:test');
const assert = require('node:assert/strict');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { renderRankCard, WIDTH, HEIGHT } = require('../reputation/rankCardImage');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fakeImageBuffer(size = 64) {
    const canvas = createCanvas(size, size);
    canvas.getContext('2d').fillRect(0, 0, size, size);
    return canvas.toBuffer('image/png');
}

// Декодирует PNG-буфер обратно в пиксели, чтобы проверить реальный цвет
// в конкретной точке (например, внутри залитой части полосы прогресса) —
// иначе тест только видит, что PNG "какой-то" валидный, но не то, что на
// нём нарисовано.
async function getPixel(png, x, y) {
    const image = await loadImage(png);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(x, y, 1, 1);
    return { r: data[0], g: data[1], b: data[2] };
}

const midLevel = {
    title: 'Участник',
    min: 5,
    color: 0x2ecc71,
    next: { title: 'Активный участник', min: 15 },
    progress: 0.5,
};
const maxLevel = { title: 'Икона сообщества', min: 200, color: 0xf1c40f, next: null, progress: 1 };

test('renderRankCard: с аватаром и баннером возвращает валидный PNG', async () => {
    const png = await renderRankCard({
        displayName: 'Тест Пользователь',
        avatarBuffer: fakeImageBuffer(),
        bannerBuffer: fakeImageBuffer(300),
        level: midLevel,
        score: 10,
        rank: 2,
    });
    assert.ok(Buffer.isBuffer(png));
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderRankCard: без баннера (градиент-заглушка) не падает', async () => {
    const png = await renderRankCard({
        displayName: 'Без баннера',
        avatarBuffer: fakeImageBuffer(),
        bannerBuffer: null,
        level: midLevel,
        score: 10,
        rank: null,
    });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderRankCard: без аватара и без ранга не падает', async () => {
    const png = await renderRankCard({
        displayName: 'Без аватара',
        avatarBuffer: null,
        bannerBuffer: null,
        level: midLevel,
        score: 0,
        rank: null,
    });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderRankCard: максимальный уровень (next=null) не падает', async () => {
    const png = await renderRankCard({
        displayName: 'Максимум',
        avatarBuffer: fakeImageBuffer(),
        bannerBuffer: null,
        level: maxLevel,
        score: 999,
        rank: 1,
    });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderRankCard: акцент (кольцо/полоса прогресса) красится в level.color', async () => {
    const png = await renderRankCard({
        displayName: 'Цвет',
        avatarBuffer: null,
        bannerBuffer: null,
        level: midLevel, // color: 0x2ecc71 → rgb(46, 204, 113)
        score: 10,
        rank: null,
    });
    // Точка внутри залитой части полосы (TEXT_X=250, y=148..174,
    // progress=0.5 при ширине бара 590px заливает примерно до x≈545) —
    // подальше от скруглённых углов и от текста над/под полосой.
    const pixel = await getPixel(png, 280, 161);
    assert.equal(pixel.r, 46);
    assert.equal(pixel.g, 204);
    assert.equal(pixel.b, 113);
});

test('renderRankCard: без level.color (старый вызов) — откатывается на цвет бренда, не падает', async () => {
    const legacyLevel = { title: 'Без цвета', min: 0, next: null, progress: 1 };
    const png = await renderRankCard({
        displayName: 'Без цвета',
        avatarBuffer: null,
        bannerBuffer: null,
        level: legacyLevel,
        score: 5,
        rank: null,
    });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderRankCard: медаль топ-3 и счётчик выданной репутации — не падает', async () => {
    const png = await renderRankCard({
        displayName: 'Топ игрок',
        avatarBuffer: fakeImageBuffer(),
        bannerBuffer: null,
        level: midLevel,
        score: 10,
        rank: 3,
        givenCount: 7,
    });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderRankCard: брендинг сервера (иконка + длинное имя, которое стоит обрезать) не падает', async () => {
    const png = await renderRankCard({
        displayName: 'С сервером',
        avatarBuffer: null,
        bannerBuffer: null,
        level: midLevel,
        score: 1,
        rank: null,
        guildName: 'Очень длинное название сервера, которое стоит обрезать',
        guildIconBuffer: fakeImageBuffer(32),
    });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('renderRankCard: имя сервера без иконки — тоже не падает', async () => {
    const png = await renderRankCard({
        displayName: 'Без иконки сервера',
        avatarBuffer: null,
        bannerBuffer: null,
        level: midLevel,
        score: 1,
        rank: null,
        guildName: 'Сервер',
        guildIconBuffer: null,
    });
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
});

test('WIDTH/HEIGHT экспортированы и положительны', () => {
    assert.ok(WIDTH > 0);
    assert.ok(HEIGHT > 0);
});
