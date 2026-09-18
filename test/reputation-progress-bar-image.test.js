const test = require('node:test');
const assert = require('node:assert/strict');
const { renderProgressBarImage, WIDTH, HEIGHT } = require('../reputation/progressBarImage');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('renderProgressBarImage возвращает валидный PNG для 0, промежуточного и максимального прогресса', () => {
    for (const progress of [0, 0.3, 0.5, 1]) {
        const buffer = renderProgressBarImage(progress);
        assert.ok(Buffer.isBuffer(buffer));
        assert.ok(buffer.length > 0);
        assert.deepEqual(buffer.subarray(0, 8), PNG_SIGNATURE);
    }
});

test('renderProgressBarImage не падает на значениях за пределами 0..1 (clamp)', () => {
    assert.doesNotThrow(() => renderProgressBarImage(-1));
    assert.doesNotThrow(() => renderProgressBarImage(2));
});

test('WIDTH/HEIGHT экспортированы и положительны', () => {
    assert.ok(WIDTH > 0);
    assert.ok(HEIGHT > 0);
});
