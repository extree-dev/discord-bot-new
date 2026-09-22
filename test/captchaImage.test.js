const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCode, generateDecoys, renderCaptcha, CODE_LENGTH } = require('../security/captchaImage');

test('generateCode: возвращает строку из CODE_LENGTH символов алфавита 0-9A-F', () => {
    for (let i = 0; i < 20; i++) {
        const code = generateCode();
        assert.equal(code.length, CODE_LENGTH);
        assert.match(code, /^[0-9A-F]+$/);
    }
});

test('generateDecoys: возвращает нужное число уникальных вариантов, ни один не совпадает с исходным кодом', () => {
    for (let i = 0; i < 20; i++) {
        const code = generateCode();
        const decoys = generateDecoys(code, 4);
        assert.equal(decoys.length, 4);
        assert.equal(new Set(decoys).size, 4);
        for (const decoy of decoys) {
            assert.notEqual(decoy, code);
            assert.equal(decoy.length, CODE_LENGTH);
        }
    }
});

test('generateDecoys: отличается от исходного кода всего 1-2 символами (похожий на вид вариант)', () => {
    const code = generateCode();
    const decoys = generateDecoys(code, 4);
    for (const decoy of decoys) {
        const diff = [...decoy].filter((ch, i) => ch !== code[i]).length;
        assert.ok(diff >= 1 && diff <= 2, `ожидали 1-2 отличия, получили ${diff} (${code} vs ${decoy})`);
    }
});

test('renderCaptcha: рисует PNG для любого кода нужной длины, не падает', () => {
    for (const code of ['000000', 'FFFFFF', generateCode(), generateCode()]) {
        const buffer = renderCaptcha(code);
        assert.ok(Buffer.isBuffer(buffer));
        assert.ok(buffer.length > 0);
        // PNG-сигнатура — минимальная проверка, что это действительно
        // валидный PNG, а не пустой/повреждённый буфер.
        assert.deepEqual(buffer.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
});
