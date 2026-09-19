// Карточка топа репутации — одна картинка (аватары, медали топ-3, счёт,
// изменение позиции), не embed/Components V2 с текстом, тот же принцип,
// что и у rankCardImage.js. Все данные (буферы аватаров, собранные из
// Discord CDN) передаются готовыми — сама функция рисования не трогает
// сеть и не трогает Discord API (см. reputation/model.js
// buildLeaderboardAttachment(), где буферы собираются).
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { ensureFonts, roundedRectPath, drawCircleImage, truncate } = require('./canvasUtils');

const WIDTH = 720;
const PADDING_X = 20;
const HEADER_HEIGHT = 72;
const ROW_HEIGHT = 58;
const ROW_GAP = 8;
const PADDING_BOTTOM = 16;
const EMPTY_HEIGHT = 100;
const AVATAR_SIZE = 40;
const NAME_MAX_CHARS = 28;

const RANK_MEDAL_COLORS = { 1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32' };
const RANK_MEDAL_ROW_BG = { 1: 'rgba(255, 215, 0, 0.1)', 2: 'rgba(192, 192, 192, 0.1)', 3: 'rgba(205, 127, 50, 0.1)' };

// Стиль "таблетки" изменения позиции относительно прошлой недели —
// see buildLeaderboardMovement() в reputation/model.js для значений
// ("+N"/"-N"/"="/"новый"). Разовый вызов /rep leaderboard движение не
// считает вообще (нет предыдущего снимка) — тогда просто не рисуем
// таблетку (entry.movement будет undefined).
const MOVEMENT_STYLES = {
    up: { bg: 'rgba(46, 204, 113, 0.18)', text: '#2ecc71' },
    down: { bg: 'rgba(231, 76, 60, 0.18)', text: '#e74c3c' },
    same: { bg: 'rgba(255, 255, 255, 0.12)', text: 'rgba(255, 255, 255, 0.7)' },
    new: { bg: 'rgba(52, 152, 219, 0.18)', text: '#3498db' },
};

function movementStyle(movement) {
    if (movement === 'новый') return MOVEMENT_STYLES.new;
    if (movement === '=') return MOVEMENT_STYLES.same;
    if (movement?.startsWith('+')) return MOVEMENT_STYLES.up;
    if (movement?.startsWith('-')) return MOVEMENT_STYLES.down;
    return MOVEMENT_STYLES.same;
}

// Рисует таблетку у правого края rightX (текст выравнивается по ней
// самой), возвращает её ширину — чтобы вызывающий код мог сдвинуть счёт
// левее и не наложиться на таблетку.
function drawMovementPill(ctx, movement, rightX, centerY) {
    const style = movementStyle(movement);
    ctx.font = '14px "NotoSansCyrillic Bold"';
    const textWidth = ctx.measureText(movement).width;
    const pillWidth = textWidth + 20;
    const pillHeight = 24;
    const pillX = rightX - pillWidth;

    roundedRectPath(ctx, pillX, centerY - pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
    ctx.fillStyle = style.bg;
    ctx.fill();

    ctx.fillStyle = style.text;
    ctx.textAlign = 'center';
    ctx.fillText(movement, pillX + pillWidth / 2, centerY + 5);
    ctx.textAlign = 'left';

    return pillWidth;
}

// entries: [{ rank, userId, displayName, avatarBuffer, score, movement? }]
// — movement отсутствует у разового /rep leaderboard (нет снимка для
// сравнения), присутствует у еженедельного автопоста.
async function renderLeaderboardCard({ title, entries }) {
    ensureFonts();
    const height = entries.length
        ? HEADER_HEIGHT + entries.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP + PADDING_BOTTOM
        : HEADER_HEIGHT + EMPTY_HEIGHT;
    const canvas = createCanvas(WIDTH, height);
    const ctx = canvas.getContext('2d');

    // Тот же тёмный градиент, что у фона rank-карточки без баннера — обе
    // картинки репутации визуально из одной "серии".
    const background = ctx.createLinearGradient(0, 0, WIDTH, height);
    background.addColorStop(0, '#1e2140');
    background.addColorStop(1, '#12142b');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, height);

    ctx.font = '26px "NotoSansCyrillic Bold"';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(title, PADDING_X, 44);

    if (!entries.length) {
        ctx.font = '18px NotoSansCyrillic';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText('Пока никто не получил репутацию.', PADDING_X, HEADER_HEIGHT + 36);
        return canvas.toBuffer('image/png');
    }

    let y = HEADER_HEIGHT;
    for (const entry of entries) {
        const rowCenterY = y + ROW_HEIGHT / 2;

        if (RANK_MEDAL_ROW_BG[entry.rank]) {
            roundedRectPath(ctx, PADDING_X, y, WIDTH - PADDING_X * 2, ROW_HEIGHT, 10);
            ctx.fillStyle = RANK_MEDAL_ROW_BG[entry.rank];
            ctx.fill();
        }

        ctx.font = '18px "NotoSansCyrillic Bold"';
        ctx.fillStyle = RANK_MEDAL_COLORS[entry.rank] ?? 'rgba(255, 255, 255, 0.6)';
        ctx.textAlign = 'left';
        ctx.fillText(`#${entry.rank}`, PADDING_X + 12, rowCenterY + 6);

        const avatarCenterX = PADDING_X + 62;
        if (entry.avatarBuffer) {
            const avatar = await loadImage(entry.avatarBuffer);
            drawCircleImage(ctx, avatar, avatarCenterX, rowCenterY, AVATAR_SIZE);
        } else {
            ctx.beginPath();
            ctx.arc(avatarCenterX, rowCenterY, AVATAR_SIZE / 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fill();
        }

        ctx.font = '18px NotoSansCyrillic';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(truncate(entry.displayName, NAME_MAX_CHARS), avatarCenterX + AVATAR_SIZE / 2 + 14, rowCenterY + 6);

        let scoreRightEdge = WIDTH - PADDING_X;
        if (entry.movement) {
            const pillWidth = drawMovementPill(ctx, entry.movement, scoreRightEdge, rowCenterY);
            scoreRightEdge -= pillWidth + 14;
        }
        ctx.font = '20px "NotoSansCyrillic Bold"';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(String(entry.score), scoreRightEdge, rowCenterY + 7);
        ctx.textAlign = 'left';

        y += ROW_HEIGHT + ROW_GAP;
    }

    return canvas.toBuffer('image/png');
}

module.exports = { renderLeaderboardCard, WIDTH };
