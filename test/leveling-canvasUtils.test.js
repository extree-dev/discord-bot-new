const test = require('node:test');
const assert = require('node:assert/strict');
const { createCanvas } = require('@napi-rs/canvas');
const { ensureFonts, formatPrestigeBadge, drawPrestigeBadge } = require('../leveling/canvasUtils');

function makeCanvas(size = 60) {
    ensureFonts();
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    // Прозрачный/чёрный фон по умолчанию — проверяем именно то, что что-то
    // непустое нарисовалось, а не просто "PNG получился".
    return { canvas, ctx };
}

function getPixel(ctx, x, y) {
    const { data } = ctx.getImageData(x, y, 1, 1);
    return { r: data[0], g: data[1], b: data[2], a: data[3] };
}

test('formatPrestigeBadge: "★N" при prestige > 0, пустая строка иначе (для текста Discord)', () => {
    assert.equal(formatPrestigeBadge(0), '');
    assert.equal(formatPrestigeBadge(2), '★2');
});

test('drawPrestigeBadge: prestige <= 0 — ничего не рисует, холст остаётся пустым', () => {
    const { ctx } = makeCanvas();
    const endX = drawPrestigeBadge(ctx, 10, 30, 0);
    assert.equal(endX, 10);
    const pixel = getPixel(ctx, 15, 25);
    assert.equal(pixel.a, 0, 'ничего не должно быть нарисовано при prestige=0');
});

// Регрессия: раньше звезда дописывалась в ту же fillText-строку символом
// "★" (U+2605) — этого символа нет в зарегистрированном кириллическом
// сабсете шрифта (ensureFonts()), поэтому вместо звезды рисовался пустой
// квадрат-заглушка. Здесь звезда — векторная фигура (заливка), поэтому
// пиксель в её центре должен быть закрашен цветом бейджа независимо от
// того, какие шрифты зарегистрированы в процессе.
test('drawPrestigeBadge: prestige > 0 — рисует звезду закрашенным пикселем в её центре (не зависит от шрифта)', () => {
    const { ctx } = makeCanvas();
    const starSize = 8;
    const x = 5;
    const baselineY = 30;
    drawPrestigeBadge(ctx, x, baselineY, 1, { color: '#f1c40f', starSize });

    const starCenterX = x + starSize;
    const starCenterY = baselineY - starSize * 0.75;
    const pixel = getPixel(ctx, starCenterX, starCenterY);
    assert.equal(pixel.a, 255, 'центр звезды должен быть непрозрачным');
    assert.equal(pixel.r, 0xf1);
    assert.equal(pixel.g, 0xc4);
    assert.equal(pixel.b, 0x0f);
});

test('drawPrestigeBadge: возвращает x после числа — дальше можно дорисовывать текст без наложения', () => {
    const { ctx } = makeCanvas();
    const endX = drawPrestigeBadge(ctx, 5, 30, 1, { starSize: 8 });
    assert.ok(endX > 5 + 8 * 2, 'конец бейджа должен быть правее самой звезды');
});

test('drawPrestigeBadge: не портит текущий font/fillStyle/textAlign после себя', () => {
    const { ctx } = makeCanvas();
    ctx.font = '16px NotoSansCyrillic';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    drawPrestigeBadge(ctx, 5, 30, 1, { starSize: 8, font: '10px "NotoSansCyrillic Bold"', color: '#f1c40f' });
    assert.equal(ctx.font, '16px NotoSansCyrillic');
    assert.equal(ctx.fillStyle, '#ffffff');
    assert.equal(ctx.textAlign, 'right');
});
