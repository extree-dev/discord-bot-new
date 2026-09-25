// Общие примитивы рисования для картинок уровня (rankCardImage.js,
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

// "2 ч 15 мин" / "40 мин" — для отображения накопленного голосового
// времени на карточке профиля и в топе. Не переиспользую formatDuration
// из tickets/model.js — та же причина, что и раньше у reputation/ (сейчас
// уже неактуальная фича): фичи не тянут зависимости друг на друга.
function formatVoiceMinutes(totalMinutes) {
    const minutes = Math.max(0, Math.round(totalMinutes));
    if (minutes < 60) return `${minutes} мин`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

// "★N" — бейдж престижа (см. model.js applyPrestige) для текстовых
// сообщений Discord (buildLevelUpCard) — рисует сам клиент Discord,
// шрифт с символом ★ у него есть. Для канвас-карточек (см.
// drawPrestigeBadge ниже) эта строка не годится — там звезду нужно
// рисовать векторной фигурой, а не текстовым символом.
function formatPrestigeBadge(prestige) {
    return prestige > 0 ? `★${prestige}` : '';
}

// Пятиконечная звезда — векторная фигура, а не текстовый символ.
function drawStar(ctx, cx, cy, outerRadius, color) {
    const spikes = 5;
    const innerRadius = outerRadius * 0.5;
    const step = Math.PI / spikes;
    let rotation = -Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rotation) * outerRadius, cy + Math.sin(rotation) * outerRadius);
    for (let i = 0; i < spikes; i++) {
        rotation += step;
        ctx.lineTo(cx + Math.cos(rotation) * innerRadius, cy + Math.sin(rotation) * innerRadius);
        rotation += step;
        ctx.lineTo(cx + Math.cos(rotation) * outerRadius, cy + Math.sin(rotation) * outerRadius);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

// Бейдж престижа на канвас-карточках ("★N" рядом с титулом яруса) —
// звезда рисуется фигурой (см. drawStar), число — обычным текстом.
// Раньше весь бейдж дописывался в ту же строку fillText, что и титул
// ("Новичок ★1"), символом ★ (U+2605) — этого символа нет в
// кириллическом сабсете Noto Sans, который регистрирует ensureFonts()
// (только буквы, без символов), поэтому вместо звезды рисовался пустой
// квадрат-заглушка (баг, найден на реальной карточке администратора
// после первого срабатывания престижа). x/baselineY — точка сразу после
// уже нарисованного текста, тот же baseline. Возвращает x после
// бейджа — если prestige <= 0, ничего не рисует и просто отдаёт x
// обратно, чтобы вызывающему коду не нужно было отдельно проверять.
function drawPrestigeBadge(ctx, x, baselineY, prestige, { color = '#f1c40f', font, starSize = 8 } = {}) {
    if (!prestige) return x;

    // Сохраняем состояние ДО drawStar — сама она ставит ctx.fillStyle =
    // color, и если сохранить fillStyle после этого вызова, "восстановим"
    // не оригинальный цвет, а только что нарисованный цвет звезды.
    const savedFont = ctx.font;
    const savedFill = ctx.fillStyle;
    const savedAlign = ctx.textAlign;

    const starCenterY = baselineY - starSize * 0.75;
    drawStar(ctx, x + starSize, starCenterY, starSize, color);

    if (font) ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    const numberX = x + starSize * 2 + 4;
    const numberText = String(prestige);
    ctx.fillText(numberText, numberX, baselineY);
    const endX = numberX + ctx.measureText(numberText).width;
    ctx.font = savedFont;
    ctx.fillStyle = savedFill;
    ctx.textAlign = savedAlign;
    return endX;
}

module.exports = {
    ensureFonts,
    roundedRectPath,
    drawCircleImage,
    truncate,
    formatVoiceMinutes,
    formatPrestigeBadge,
    drawPrestigeBadge,
};
