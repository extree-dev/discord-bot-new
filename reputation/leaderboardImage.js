// Карточка топа репутации — одна картинка, не embed/Components V2 с
// текстом, тот же принцип, что и у rankCardImage.js. Подиум для топ-3
// (крупнее аватары, пьедестал по высоте места, звезда над первым местом)
// и список для остальных — с уровнем и выданной репутацией у каждой
// строки, не только счётом. Все данные (буферы аватаров, собранные из
// Discord CDN, level — чистая функция от score) передаются готовыми —
// сама функция рисования не трогает сеть и не трогает Discord API (см.
// reputation/model.js buildLeaderboardAttachment(), где они собираются).
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { ensureFonts, roundedRectPath, drawCircleImage, truncate } = require('./canvasUtils');

const WIDTH = 760;
const PADDING_X = 24;
const HEADER_HEIGHT = 78;

// --- Подиум (топ-3) ---
const PODIUM_AVATAR_SIZE = { 1: 84, 2: 64, 3: 64 };
const PODIUM_PEDESTAL_HEIGHT = { 1: 74, 2: 50, 3: 34 };
const PODIUM_COLUMN_OFFSET = 236; // расстояние от центра (#1) до #2/#3
const PODIUM_BAR_WIDTH = 176;
const PODIUM_AVATAR_CENTER_Y = 78; // от начала подиума, одна высота на все 3 колонки
const PODIUM_NAME_GAP = 26; // от нижнего края самого большого аватара до имени
const PODIUM_NAME_TO_LEVEL = 20;
const PODIUM_LEVEL_TO_SCORE = 28;
const PODIUM_SCORE_TO_PILL = 22;
const PODIUM_PILL_TO_PEDESTAL = 18;
const PODIUM_BOTTOM_MARGIN = 20;

const SECTION_GAP = 28;

// --- Список (места 4+) ---
const ROW_HEIGHT = 68;
const ROW_GAP = 10;
const PADDING_BOTTOM = 16;
const EMPTY_HEIGHT = 100;
const LIST_AVATAR_SIZE = 44;
const NAME_MAX_CHARS = 24;
const PODIUM_NAME_MAX_CHARS = 14;

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

// Пятиконечная звезда — бейдж над первым местом на подиуме.
function drawStar(ctx, cx, cy, outerR, innerR, color) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

// Таблетка по центру x=centerX (в отличие от списка, где она у правого
// края) — возвращает нижнюю границу, чтобы вызывающий код знал, где
// начинать пьедестал.
function drawMovementPillCentered(ctx, movement, centerX, centerY) {
    const style = movementStyle(movement);
    ctx.font = '13px "NotoSansCyrillic Bold"';
    const textWidth = ctx.measureText(movement).width;
    const pillWidth = textWidth + 18;
    const pillHeight = 22;

    roundedRectPath(ctx, centerX - pillWidth / 2, centerY - pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
    ctx.fillStyle = style.bg;
    ctx.fill();

    ctx.fillStyle = style.text;
    ctx.textAlign = 'center';
    ctx.fillText(movement, centerX, centerY + 4);
    ctx.textAlign = 'left';
}

async function drawPodiumColumn(ctx, entry, columnX, topOffset) {
    const rank = entry.rank;
    const avatarSize = PODIUM_AVATAR_SIZE[rank];
    const avatarCenterY = topOffset + PODIUM_AVATAR_CENTER_Y;
    const accent = RANK_MEDAL_COLORS[rank];

    if (rank === 1) {
        drawStar(ctx, columnX, avatarCenterY - PODIUM_AVATAR_SIZE[1] / 2 - 20, 14, 6, '#ffd700');
    }

    // Мягкое свечение под аватаром в цвет медали — без этого подиум и
    // список смотрятся одинаково плоско, а именно "плоско и скучно" было
    // основной претензией к первой версии картинки.
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(columnX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.restore();

    if (entry.avatarBuffer) {
        const avatar = await loadImage(entry.avatarBuffer);
        drawCircleImage(ctx, avatar, columnX, avatarCenterY, avatarSize - 6);
    }
    ctx.beginPath();
    ctx.arc(columnX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.stroke();

    const maxAvatarBottom = avatarCenterY + PODIUM_AVATAR_SIZE[1] / 2;
    const nameY = maxAvatarBottom + PODIUM_NAME_GAP;
    const levelY = nameY + PODIUM_NAME_TO_LEVEL;
    const scoreY = levelY + PODIUM_LEVEL_TO_SCORE;

    ctx.textAlign = 'center';
    ctx.font = '18px "NotoSansCyrillic Bold"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(truncate(entry.displayName, PODIUM_NAME_MAX_CHARS), columnX, nameY);

    ctx.font = '13px NotoSansCyrillic';
    ctx.fillStyle = levelColorHex(entry.level);
    ctx.fillText(entry.level?.title ?? '', columnX, levelY);

    ctx.font = '24px "NotoSansCyrillic Bold"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(entry.score), columnX, scoreY);

    if (entry.movement) {
        drawMovementPillCentered(ctx, entry.movement, columnX, scoreY + PODIUM_SCORE_TO_PILL);
    }

    const pedestalTop =
        scoreY + (entry.movement ? PODIUM_SCORE_TO_PILL + PODIUM_PILL_TO_PEDESTAL : PODIUM_SCORE_TO_PILL);
    const pedestalHeight = PODIUM_PEDESTAL_HEIGHT[rank];
    const pedestalGradient = ctx.createLinearGradient(0, pedestalTop, 0, pedestalTop + pedestalHeight);
    pedestalGradient.addColorStop(0, accent);
    pedestalGradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    roundedRectPath(ctx, columnX - PODIUM_BAR_WIDTH / 2, pedestalTop, PODIUM_BAR_WIDTH, pedestalHeight, 10);
    ctx.fillStyle = pedestalGradient;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.font = '22px "NotoSansCyrillic Bold"';
    ctx.fillStyle = accent;
    ctx.fillText(`#${rank}`, columnX, pedestalTop + pedestalHeight / 2 + 8);
    ctx.textAlign = 'left';

    return pedestalTop + pedestalHeight;
}

async function drawListRow(ctx, entry, y) {
    const rowCenterY = y + ROW_HEIGHT / 2;

    roundedRectPath(ctx, PADDING_X, y, WIDTH - PADDING_X * 2, ROW_HEIGHT, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();

    ctx.font = '15px "NotoSansCyrillic Bold"';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.textAlign = 'left';
    ctx.fillText(`#${entry.rank}`, PADDING_X + 14, rowCenterY + 5);

    const avatarCenterX = PADDING_X + 66;
    const accent = levelColorHex(entry.level);
    if (entry.avatarBuffer) {
        const avatar = await loadImage(entry.avatarBuffer);
        drawCircleImage(ctx, avatar, avatarCenterX, rowCenterY, LIST_AVATAR_SIZE - 4);
    } else {
        ctx.beginPath();
        ctx.arc(avatarCenterX, rowCenterY, (LIST_AVATAR_SIZE - 4) / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(avatarCenterX, rowCenterY, LIST_AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const textX = avatarCenterX + LIST_AVATAR_SIZE / 2 + 16;
    ctx.font = '17px "NotoSansCyrillic Bold"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(truncate(entry.displayName, NAME_MAX_CHARS), textX, rowCenterY - 6);

    // Вторая строка — уровень (цветной кружок-индикатор + титул) и сколько
    // репутации сам выдал. Раньше в строке был только счёт — по фидбэку
    // "мало информации на строку" добавлено то, что реально есть в данных
    // и ничего не стоит показать (level — чистая функция от score,
    // givenCount уже приходит из getLeaderboard()).
    const dotY = rowCenterY + 13;
    ctx.beginPath();
    ctx.arc(textX + 4, dotY - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();

    ctx.font = '13px NotoSansCyrillic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const subtitle = `${entry.level?.title ?? ''} · Выдал: ${entry.givenCount ?? 0}`;
    ctx.fillText(subtitle, textX + 14, dotY);

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

// entries: [{ rank, userId, displayName, avatarBuffer, score, givenCount,
// level, movement? }] — movement отсутствует у разового /rep leaderboard
// (нет снимка для сравнения), присутствует у еженедельного автопоста.
// Топ-3 рисуются подиумом, остальные — списком.
async function renderLeaderboardCard({ title, entries }) {
    ensureFonts();

    const podiumEntries = entries.filter(e => e.rank <= 3);
    const listEntries = entries.filter(e => e.rank > 3);
    const podiumHeight = podiumEntries.length
        ? PODIUM_AVATAR_CENTER_Y +
          PODIUM_AVATAR_SIZE[1] / 2 +
          PODIUM_NAME_GAP +
          PODIUM_NAME_TO_LEVEL +
          PODIUM_LEVEL_TO_SCORE +
          Math.max(...podiumEntries.map(e => PODIUM_PEDESTAL_HEIGHT[e.rank])) +
          PODIUM_SCORE_TO_PILL +
          (podiumEntries.some(e => e.movement) ? PODIUM_PILL_TO_PEDESTAL : 0) +
          PODIUM_BOTTOM_MARGIN
        : 0;
    const listHeight = listEntries.length
        ? SECTION_GAP + listEntries.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP + PADDING_BOTTOM
        : podiumEntries.length
          ? PADDING_BOTTOM
          : 0;
    const height = entries.length ? HEADER_HEIGHT + podiumHeight + listHeight : HEADER_HEIGHT + EMPTY_HEIGHT;

    const canvas = createCanvas(WIDTH, height);
    const ctx = canvas.getContext('2d');

    // Акцент шапки берётся от цвета уровня лидера — тот же приём, что и у
    // фона rank-карточки без баннера, только здесь он завязан на данные
    // (у разных серверов/недель топ красится по-разному), а не на один и
    // тот же статичный градиент каждый раз.
    const headerAccent = entries.length ? levelColorHex(entries[0].level) : DEFAULT_LEVEL_COLOR;
    const background = ctx.createLinearGradient(0, 0, WIDTH, height);
    background.addColorStop(0, headerAccent);
    background.addColorStop(0.25, '#1e2140');
    background.addColorStop(1, '#12142b');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, WIDTH, height);
    // Затемнение поверх градиента — сам градиент только у самого верха
    // как акцентная подсветка, ниже уже ровный тёмный фон под текст.
    const overlay = ctx.createLinearGradient(0, 0, 0, height);
    overlay.addColorStop(0, 'rgba(18, 20, 43, 0.35)');
    overlay.addColorStop(0.3, 'rgba(18, 20, 43, 0.92)');
    overlay.addColorStop(1, 'rgba(18, 20, 43, 0.92)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, WIDTH, height);

    ctx.font = '28px "NotoSansCyrillic Bold"';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(title, PADDING_X, 42);

    ctx.font = '14px NotoSansCyrillic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(
        entries.length
            ? `${entries.length} участник${pluralSuffix(entries.length)} в топе`
            : 'Пока никто не получил репутацию.',
        PADDING_X,
        64
    );

    if (!entries.length) {
        return canvas.toBuffer('image/png');
    }

    let cursorY = HEADER_HEIGHT;
    if (podiumEntries.length) {
        const centerX = WIDTH / 2;
        const columnX = { 1: centerX, 2: centerX - PODIUM_COLUMN_OFFSET, 3: centerX + PODIUM_COLUMN_OFFSET };
        // Рисуем #2 и #3 первыми, #1 поверх — его звезда/свечение крупнее и
        // не должна перекрываться соседними колонками при небольшом заходе.
        for (const entry of podiumEntries.filter(e => e.rank !== 1)) {
            await drawPodiumColumn(ctx, entry, columnX[entry.rank], cursorY);
        }
        const first = podiumEntries.find(e => e.rank === 1);
        if (first) await drawPodiumColumn(ctx, first, columnX[1], cursorY);
        cursorY += podiumHeight;
    }

    if (listEntries.length) {
        cursorY += SECTION_GAP;
        for (const entry of listEntries) {
            await drawListRow(ctx, entry, cursorY);
            cursorY += ROW_HEIGHT + ROW_GAP;
        }
    }

    return canvas.toBuffer('image/png');
}

function pluralSuffix(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return '';
    if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'а';
    return 'ов';
}

module.exports = { renderLeaderboardCard, WIDTH };
