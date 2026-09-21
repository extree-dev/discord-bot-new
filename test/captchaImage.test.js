const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCode, renderCaptcha, CODE_LENGTH } = require('../security/captchaImage');

test('generateCode: возвращает строку из CODE_LENGTH цифр', () => {
    for (let i = 0; i < 20; i++) {
        const code = generateCode();
        assert.equal(code.length, CODE_LENGTH);
        assert.match(code, /^\d+$/);
    }
});

test('renderCaptcha: рисует PNG для любого кода нужной длины, не падает', () => {
    for (const code of ['00000', '99999', generateCode(), generateCode()]) {
        const buffer = renderCaptcha(code);
        assert.ok(Buffer.isBuffer(buffer));
        assert.ok(buffer.length > 0);
        // PNG-сигнатура — минимальная проверка, что это действительно
        // валидный PNG, а не пустой/повреждённый буфер.
        assert.deepEqual(buffer.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
});
