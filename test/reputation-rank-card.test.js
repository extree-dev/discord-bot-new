const test = require('node:test');
const assert = require('node:assert/strict');
const { createCanvas } = require('@napi-rs/canvas');
const { renderRankCard, WIDTH, HEIGHT } = require('../reputation/rankCardImage');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fakeImageBuffer(size = 64) {
    const canvas = createCanvas(size, size);
    canvas.getContext('2d').fillRect(0, 0, size, size);
    return canvas.toBuffer('image/png');
}

const midLevel = { title: 'Участник', min: 5, next: { title: 'Активный участник', min: 15 }, progress: 0.5 };
const maxLevel = { title: 'Икона сообщества', min: 200, next: null, progress: 1 };

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

test('WIDTH/HEIGHT экспортированы и положительны', () => {
    assert.ok(WIDTH > 0);
    assert.ok(HEIGHT > 0);
});
