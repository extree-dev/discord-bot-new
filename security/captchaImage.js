// Картинка-капча для верификации: код рисуется искажёнными цифрами на
// зашумленном фоне, а не текстом в лейбле модалки (как было раньше) —
// раньше ответ ("Сколько будет 3 + 5?") был обычным текстом компонента,
// который простейший скрипт-бот читает и решает регуляркой за миллисекунды.
// Картинку без OCR не прочитать. Discord-модалки не умеют показывать
// картинки напрямую (только текстовые поля), поэтому картинка уходит
// отдельным сообщением с кнопкой "Ввести код", а сам ввод уже собирается
// в модалке (см. verification.js).
//
// Не переиспользует ensureFonts() из leveling/canvasUtils.js — фичи не
// тянут зависимости друг на друга (см. аналогичный комментарий у
// formatVoiceMinutes в canvasUtils.js), регистрирует свой шрифт под
// собственным именем семейства.
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

const WIDTH = 220;
const HEIGHT = 80;
const CODE_LENGTH = 5;
const FONT_FAMILY = 'CaptchaDigits';

let fontRegistered = false;
function ensureFont() {
    if (fontRegistered) return;
    const fontsDir = path.join(__dirname, '..', 'node_modules', '@openfonts', 'noto-sans_cyrillic', 'files');
    GlobalFonts.registerFromPath(path.join(fontsDir, 'noto-sans-cyrillic-700.woff2'), FONT_FAMILY);
    fontRegistered = true;
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function generateCode() {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += Math.floor(Math.random() * 10);
    return code;
}

// Чистая функция рисования — принимает готовый код, сама ничего не
// решает и не трогает Discord API, поэтому тестируется отдельно (просто
// не падает на любом валидном коде).
function renderCaptcha(code) {
    ensureFont();
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, '#1e2140');
    bg.addColorStop(1, '#2a2d5c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Линии-помехи РИСУЮТСЯ ПОД цифрами — поверх они перекрывали бы сами
    // цифры и мешали бы уже человеку, а не только автоматическому OCR.
    for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(randomBetween(0, WIDTH), randomBetween(0, HEIGHT));
        ctx.lineTo(randomBetween(0, WIDTH), randomBetween(0, HEIGHT));
        ctx.strokeStyle = `rgba(255, 255, 255, ${randomBetween(0.08, 0.2)})`;
        ctx.lineWidth = randomBetween(1, 2);
        ctx.stroke();
    }

    const slotWidth = WIDTH / code.length;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (let i = 0; i < code.length; i++) {
        const cx = slotWidth * i + slotWidth / 2;
        const cy = HEIGHT / 2 + randomBetween(-6, 6);
        const angle = randomBetween(-0.35, 0.35);
        const size = Math.round(randomBetween(30, 38));

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.font = `${size}px ${FONT_FAMILY}`;
        ctx.fillStyle = `hsl(0, 0%, ${Math.round(randomBetween(85, 98))}%)`;
        ctx.fillText(code[i], 0, 0);
        ctx.restore();
    }

    // Точечный шум поверх всего — сбивает распознавание по чистым краям
    // символов, человеку читать код целиком не мешает.
    for (let i = 0; i < 120; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${randomBetween(0.05, 0.15)})`;
        ctx.fillRect(randomBetween(0, WIDTH), randomBetween(0, HEIGHT), 1, 1);
    }

    return canvas.toBuffer('image/png');
}

module.exports = { generateCode, renderCaptcha, CODE_LENGTH };
