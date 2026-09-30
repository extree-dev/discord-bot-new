// По прямому запросу администратора: в панели выбора цвета ника (см.
// rolePanel/colors.js) у каждого варианта меню — не юникод-кружок, а
// кастомный эмодзи сервера, залитый под цвет палитры (так уже сделано у
// официального бота VALORANT СНГ и у наших игровых ролей через
// customEmojiName/resolveEmoji, см. scripts/setup-role-panel.js). Форма
// иконки — "swatch" (палитра/тюбик с краской) из Heroicons
// (https://heroicons.com, MIT license, https://github.com/tailwindlabs/
// heroicons/blob/master/LICENSE) — путь SVG вставлен прямо сюда как
// константа, а не подгружается с диска/сети во время работы бота.
// Заливает готовые PNG на сервер scripts/upload-color-emojis.js (разовый
// ручной скрипт, не входит в деплой).
const { createCanvas, Path2D } = require('@napi-rs/canvas');

const SWATCH_PATH_EVENODD =
    'M2.25 4.125c0-1.036.84-1.875 1.875-1.875h5.25c1.036 0 1.875.84 1.875 1.875V17.25a4.5 4.5 0 1 1-9 0V4.125Zm4.5 14.25a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z';
const SWATCH_PATH_NONZERO =
    'M10.719 21.75h9.156c1.036 0 1.875-.84 1.875-1.875v-5.25c0-1.036-.84-1.875-1.875-1.875h-.14l-8.742 8.743c-.09.089-.18.175-.274.257ZM12.738 17.625l6.474-6.474a1.875 1.875 0 0 0 0-2.651L15.5 4.787a1.875 1.875 0 0 0-2.651 0l-.1.099V17.25c0 .126-.003.251-.01.375Z';

// 128×128 — достаточно резко для эмодзи (Discord показывает их мелко,
// ~22-44px), но заметно меньше лимита в 256 КБ на файл для загрузки.
const EMOJI_SIZE = 128;
const ICON_VIEWBOX = 24;

function renderColorEmojiPng(hex) {
    const canvas = createCanvas(EMOJI_SIZE, EMOJI_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.scale(EMOJI_SIZE / ICON_VIEWBOX, EMOJI_SIZE / ICON_VIEWBOX);
    ctx.fillStyle = `#${hex.toString(16).padStart(6, '0')}`;
    ctx.fill(new Path2D(SWATCH_PATH_EVENODD), 'evenodd');
    ctx.fill(new Path2D(SWATCH_PATH_NONZERO), 'nonzero');
    return canvas.toBuffer('image/png');
}

module.exports = { renderColorEmojiPng };
