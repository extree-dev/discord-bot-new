// Карточка профиля репутации — одна картинка (баннер профиля как фон,
// круглый аватар, имя/уровень/счёт/полоса прогресса, место в рейтинге),
// а не embed/Components V2 с текстом. Все данные (буферы аватара/баннера,
// собранные из Discord CDN) передаются готовыми — сама функция рисования
// не трогает сеть и не трогает Discord API, поэтому тестируется отдельно
// (см. reputation/model.js buildRankCardAttachment(), где буферы
// собираются).
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const { COLORS } = require('../utils/embeds');

const WIDTH = 900;
const HEIGHT = 270;
const AVATAR_SIZE = 150;
const AVATAR_X = 60;
const AVATAR_Y = (HEIGHT - AVATAR_SIZE) / 2;
const TEXT_X = AVATAR_X + AVATAR_SIZE + 40;
const PRIMARY_HEX = `#${COLORS.primary.toString(16).padStart(6, '0')}`;

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

// "background-size: cover" — растягивает картинку под область, обрезая
// излишек по длинной стороне, вместо того чтобы сжимать/искажать баннер.
function drawImageCover(ctx, image, x, y, w, h) {
    const scale = Math.max(w / image.width, h / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const drawX = x + (w - drawWidth) / 2;
    const drawY = y + (h - drawHeight) / 2;
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawProgressBar(ctx, x, y, w, h, progress) {
    const clamped = Math.max(0, Math.min(1, progress));
    roundedRectPath(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();

    if (clamped > 0) {
        const filledWidth = Math.max(h, w * clamped);
        roundedRectPath(ctx, x, y, filledWidth, h, h / 2);
        ctx.fillStyle = PRIMARY_HEX;
        ctx.fill();
    }
}

// avatarBuffer/bannerBuffer — PNG/JPEG Buffer или null (у пользователя
// может не быть баннера вообще — тогда фон заменяет градиент).
async function renderRankCard({ displayName, avatarBuffer, bannerBuffer, level, score, rank }) {
    ensureFonts();
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    if (bannerBuffer) {
        const banner = await loadImage(bannerBuffer);
        drawImageCover(ctx, banner, 0, 0, WIDTH, HEIGHT);
    } else {
        const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
        gradient.addColorStop(0, PRIMARY_HEX);
        gradient.addColorStop(1, '#1e2140');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Затемнение слева направо — под текстом фон почти чёрный, у правого
    // края (где баннер виден полностью) — почти прозрачное.
    const overlay = ctx.createLinearGradient(0, 0, WIDTH, 0);
    overlay.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
    overlay.addColorStop(0.6, 'rgba(0, 0, 0, 0.55)');
    overlay.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const avatarCenterX = AVATAR_X + AVATAR_SIZE / 2;
    const avatarCenterY = AVATAR_Y + AVATAR_SIZE / 2;

    if (avatarBuffer) {
        const avatar = await loadImage(avatarBuffer);
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarCenterX, avatarCenterY, AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, AVATAR_SIZE / 2 + 3, 0, Math.PI * 2);
    ctx.strokeStyle = PRIMARY_HEX;
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '34px "NotoSansCyrillic Bold"';
    ctx.fillText(displayName, TEXT_X, 78);

    ctx.font = '22px NotoSansCyrillic';
    ctx.fillStyle = '#c9cdfb';
    ctx.fillText(level.title, TEXT_X, 112);

    ctx.font = '20px NotoSansCyrillic';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    const scoreLabel = level.next ? `${score} / ${level.next.min}` : `${score} (максимум)`;
    ctx.fillText(scoreLabel, WIDTH - 60, 112);
    ctx.textAlign = 'left';

    drawProgressBar(ctx, TEXT_X, 148, WIDTH - TEXT_X - 60, 26, level.progress);

    if (rank) {
        ctx.font = '26px "NotoSansCyrillic Bold"';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(`#${rank}`, WIDTH - 30, 45);
        ctx.textAlign = 'left';
    }

    return canvas.toBuffer('image/png');
}

module.exports = { renderRankCard, WIDTH, HEIGHT };
