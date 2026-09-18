// Картинка полосы прогресса для /rep profile — чистая функция (progress
// 0..1 на входе, PNG Buffer на выходе), без обращений к Discord API,
// поэтому легко тестируется отдельно от рендеринга самого сообщения.
// Текст (счёт/уровень) остаётся обычным Discord-текстом в карточке —
// в картинке только сама полоса, чтобы не дублировать и не терять
// доступность текста, если картинка не загрузится.
const { createCanvas } = require('@napi-rs/canvas');
const { COLORS } = require('../utils/embeds');

const WIDTH = 400;
const HEIGHT = 28;
const RADIUS = HEIGHT / 2;
const TRACK_COLOR = '#2b2d31'; // фон полосы — тон панелей тёмной темы Discord
const FILL_COLOR = `#${COLORS.primary.toString(16).padStart(6, '0')}`;

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

function renderProgressBarImage(progress) {
    const clamped = Math.max(0, Math.min(1, progress));
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    roundedRectPath(ctx, 0, 0, WIDTH, HEIGHT, RADIUS);
    ctx.fillStyle = TRACK_COLOR;
    ctx.fill();

    if (clamped > 0) {
        const filledWidth = Math.max(HEIGHT, WIDTH * clamped);
        roundedRectPath(ctx, 0, 0, filledWidth, HEIGHT, RADIUS);
        ctx.fillStyle = FILL_COLOR;
        ctx.fill();
    }

    return canvas.toBuffer('image/png');
}

module.exports = { renderProgressBarImage, WIDTH, HEIGHT };
