// Общие примитивы рисования для картинок репутации (rankCardImage.js,
// leaderboardImage.js) — регистрация шрифтов, скруглённые прямоугольники,
// круглые изображения, обрезка длинного текста. Вынесено сюда, чтобы обе
// карточки не дублировали одну и ту же логику по отдельности.
const { GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// GlobalFonts — процесс-глобальный реестр, регистрируем один раз: без
// этого на деплое (Alpine, node:20-alpine — без единого системного
// шрифта) кириллица рисовалась бы пустыми прямоугольниками вместо букв.
let fontsRegistered = false;
function ensureFonts() {
    if (fontsRegistered) return;
    const fontsDir = path.join(__dirname, '..', 'node_modules', '@openfonts', 'noto-sans_cyrillic', 'files');
    GlobalFonts.registerFromPath(path.join(fontsDir, 'noto-sans-cyrillic-400.woff2'), 'NotoSansCyrillic');
    GlobalFonts.registerFromPath(path.join(fontsDir, 'noto-sans-cyrillic-700.woff2'), 'NotoSansCyrillic Bold');
    fontsRegistered = true;
}

function roundedRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, h / 2, w / 2 || r);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

// Рисует картинку внутри круга радиусом size/2 с центром в (cx, cy).
function drawCircleImage(ctx, image, cx, cy, size) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
}

function truncate(text, maxChars) {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars - 1)}…`;
}

module.exports = { ensureFonts, roundedRectPath, drawCircleImage, truncate };
