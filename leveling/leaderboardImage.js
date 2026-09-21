// Карточка топа активности — одна картинка, не embed/Components V2 с
// текстом. Единый визуальный язык с rankCardImage.js: каждая строка —
// мини-версия карточки профиля (аватар в рамке цвета уровня, полоса
// прогресса того же цвета), без пьедесталов и эффектов — все места
// одинаковые строки, топ-3 отмечены только цветом номера места (та же
// договорённость, что была у прежней системы репутации, откуда этот
// визуальный язык унаследован). Все данные (буферы аватаров, собранные
// из Discord CDN, level — чистая функция от score) передаются готовыми —
// сама функция рисования не трогает сеть и не трогает Discord API (см.
// leveling/model.js buildLeaderboardAttachment()).
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { ensureFonts, roundedRectPath, drawCircleImage, truncate } = require('./canvasUtils');

const WIDTH = 720;
const PADDING_X = 24;
const HEADER_HEIGHT = 78;

const ROW_HEIGHT = 78;
const ROW_GAP = 10;
const PADDING_BOTTOM = 16;
const EMPTY_HEIGHT = 100;
const AVATAR_SIZE = 48;
const RANK_COL_WIDTH = 40;
const NAME_MAX_CHARS = 26;
const BAR_WIDTH = 130;
const BAR_HEIGHT = 6;

const RANK_MEDAL_COLORS = { 1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32' };
const DEFAULT_LEVEL_COLOR = '#99aab5';

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

function levelColorHex(level) {
    return typeof level?.color === 'number' ? `#${level.color.toString(16).padStart(6, '0')}` : DEFAULT_LEVEL_COLOR;
}

function drawProgressBar(ctx, x, y, w, h, progress, colorHex) {
    const clamped = Math.max(0, Math.min(1, progress ?? 0));
    roundedRectPath(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();

    if (clamped > 0) {
        const filledWidth = Math.max(h, w * clamped);
        roundedRectPath(ctx, x, y, filledWidth, h, h / 2);
        ctx.fillStyle = colorHex;
        ctx.fill();
    }
}

async function drawRow(ctx, entry, y) {
    const rowCenterY = y + ROW_HEIGHT / 2;
    const accent = levelColorHex(entry.level);

    roundedRectPath(ctx, PADDING_X, y, WIDTH - PADDING_X * 2, ROW_HEIGHT, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();

    ctx.font = '16px "NotoSansCyrillic Bold"';
    ctx.fillStyle = RANK_MEDAL_COLORS[entry.rank] ?? 'rgba(255, 255, 255, 0.55)';
    ctx.textAlign = 'right';
    ctx.fillText(`#${entry.rank}`, PADDING_X + RANK_COL_WIDTH - 6, rowCenterY + 6);
    ctx.textAlign = 'left';

    const avatarCenterX = PADDING_X + RANK_COL_WIDTH + AVATAR_SIZE / 2;
    if (entry.avatarBuffer) {
        const avatar = await loadImage(entry.avatarBuffer);
        drawCircleImage(ctx, avatar, avatarCenterX, rowCenterY, AVATAR_SIZE - 4);
    } else {
        ctx.beginPath();
        ctx.arc(avatarCenterX, rowCenterY, (AVATAR_SIZE - 4) / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(avatarCenterX, rowCenterY, AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const textX = avatarCenterX + AVATAR_SIZE / 2 + 16;
    ctx.font = '16px "NotoSansCyrillic Bold"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(truncate(entry.displayName, NAME_MAX_CHARS), textX, y + 28);

    // Вторая строка — уровень (цветной кружок-индикатор + титул) и сколько
    // сообщений отправлено. Третья — тонкая полоса прогресса до следующего
    // уровня, тем же цветом, что кольцо аватара — тот же визуальный язык,
    // что у /level profile.
    const dotY = y + 44;
    ctx.beginPath();
    ctx.arc(textX + 4, dotY - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();

    ctx.font = '12px NotoSansCyrillic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(
        `${entry.level?.title ?? ''} (ур. ${entry.level?.number ?? 0}) · Сообщений: ${entry.messageCount ?? 0}`,
        textX + 14,
        dotY
    );

    drawProgressBar(ctx, textX, y + 54, BAR_WIDTH, BAR_HEIGHT, entry.level?.progress, accent);

    let scoreRightEdge = WIDTH - PADDING_X - 14;
    if (entry.movement) {
        const style = movementStyle(entry.movement);
        ctx.font = '13px "NotoSansCyrillic Bold"';
        const pillWidth = ctx.measureText(entry.movement).width + 18;
        const pillHeight = 22;
        const pillX = scoreRightEdge - pillWidth;
        roundedRectPath(ctx, pillX, rowCenterY - pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
        ctx.fillStyle = style.bg;
        ctx.fill();
        ctx.fillStyle = style.text;
        ctx.textAlign = 'center';
        ctx.fillText(entry.movement, pillX + pillWidth / 2, rowCenterY + 4);
        ctx.textAlign = 'left';
        scoreRightEdge = pillX - 14;
    }
    ctx.font = '22px "NotoSansCyrillic Bold"';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(String(entry.score), scoreRightEdge, rowCenterY + 7);
    ctx.textAlign = 'left';
}

function pluralSuffix(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return '';
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'а';
    return 'ов';
}

// entries: [{ rank, userId, displayName, avatarBuffer, score, messageCount,
// level, movement? }] — movement отсутствует у разового /level leaderboard
// (нет снимка для сравнения), присутствует у еженедельного автопоста.
async function renderLeaderboardCard({ title, entries }) {
    ensureFonts();

    const height = entries.length
        ? HEADER_HEIGHT + entries.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP + PADDING_BOTTOM
        : HEADER_HEIGHT + EMPTY_HEIGHT;

    const canvas = createCanvas(WIDTH, height);
    const ctx = canvas.getContext('2d');

    // Акцент шапки — цвет уровня лидера топа, тот же приём, что у фона
    // rank-карточки без баннера: картинка красится по данным, а не одним
    // статичным градиентом каждый раз.
    const headerAccent = entries.length ? levelColorHex(entries[0].level) : DEFAULT_LEVEL_COLOR;
    const background = ctx.createLinearGradient(0, 0, WIDTH, height);
    background.addColorStop(0, headerAccent);
    background.addColorStop(0.2, '#1e2140');
    background.addColorStop(1, '#12142b');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, height);
    const overlay = ctx.createLinearGradient(0, 0, 0, height);
    overlay.addColorStop(0, 'rgba(18, 20, 43, 0.4)');
    overlay.addColorStop(0.25, 'rgba(18, 20, 43, 0.92)');
    overlay.addColorStop(1, 'rgba(18, 20, 43, 0.92)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, WIDTH, height);

    ctx.font = '26px "NotoSansCyrillic Bold"';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(title, PADDING_X, 42);

    ctx.font = '14px NotoSansCyrillic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(
        entries.length
            ? `${entries.length} участник${pluralSuffix(entries.length)} в топе`
            : 'Пока никто не набрал очков активности.',
        PADDING_X,
        64
    );

    let y = HEADER_HEIGHT;
    for (const entry of entries) {
        await drawRow(ctx, entry, y);
        y += ROW_HEIGHT + ROW_GAP;
    }

    return canvas.toBuffer('image/png');
}

module.exports = { renderLeaderboardCard, WIDTH };
