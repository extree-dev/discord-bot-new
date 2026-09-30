// По прямому запросу администратора: в панели выбора цвета ника (см.
// rolePanel/colors.js) у каждого варианта меню — не юникод-кружок, а
// кастомный эмодзи сервера, залитый под цвет палитры (так уже сделано у
// официального бота VALORANT СНГ и у наших игровых ролей через
// customEmojiName/resolveEmoji, см. scripts/setup-role-panel.js). Форма
// иконки — гранёный алмаз (контур + грань) из Tabler Icons
// (https://tabler.io/icons, MIT license, https://github.com/tabler/
// tabler-icons/blob/main/LICENSE) — путь SVG вставлен прямо сюда как
// константа, а не подгружается с диска/сети во время работы бота.
// Заливает готовые PNG на сервер scripts/upload-color-emojis.js (разовый
// ручной скрипт, не входит в деплой).
const { createCanvas, Path2D } = require('@napi-rs/canvas');

const DIAMOND_OUTLINE_PATH = 'M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5';
const DIAMOND_FACET_PATH = 'M10 12l-2 -2.2l.6 -1';

// 128×128 — достаточно резко для эмодзи (Discord показывает их мелко,
// ~22-44px), но заметно меньше лимита в 256 КБ на файл для загрузки.
const EMOJI_SIZE = 128;
const ICON_VIEWBOX = 24;

function renderColorEmojiPng(hex) {
    const canvas = createCanvas(EMOJI_SIZE, EMOJI_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.scale(EMOJI_SIZE / ICON_VIEWBOX, EMOJI_SIZE / ICON_VIEWBOX);

    const outline = new Path2D(DIAMOND_OUTLINE_PATH);
    const facet = new Path2D(DIAMOND_FACET_PATH);

    ctx.fillStyle = `#${hex.toString(16).padStart(6, '0')}`;
    ctx.fill(outline);

    // Тонкий тёмный контур поверх заливки — без него светлые цвета
    // (белый, жёлтый) сливались бы с любым светлым фоном Discord, а
    // линия грани внутри вообще не была бы видна.
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = ICON_VIEWBOX * 0.05;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(outline);
    ctx.stroke(facet);

    return canvas.toBuffer('image/png');
}

module.exports = { renderColorEmojiPng };
