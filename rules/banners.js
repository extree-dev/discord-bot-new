// Баннеры-картинки для карточек правил (стиль "F", выбранный администратором
// из нескольких вариантов): тёмный фон с точечной сеткой, светящийся круглый
// бейдж с тематической иконкой слева, заголовок карточки справа. Рисуются
// кодом через @napi-rs/canvas (та же библиотека, что и у leveling/ для
// карточек профиля/топа) — готовых арт-ассетов у бота нет, а референс с
// другого сервера использовал кастомную иллюстрацию, которую нечем
// воспроизвести. Баннеры статичны (не зависят от участника/гильдии), поэтому
// рендерятся один раз при первом обращении и кэшируются в памяти процесса,
// а не на каждый вызов /rules.
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

const W = 900;
const H = 260;
const ACCENT = '#5865f2';
const DARK = '#0a0b14';
const BADGE_CX = 120;
const BADGE_CY = H / 2;

let fontsRegistered = false;
function ensureFonts() {
    if (fontsRegistered) return;
    const fontsDir = path.join(__dirname, '..', 'node_modules', '@openfonts', 'noto-sans_cyrillic', 'files');
    GlobalFonts.registerFromPath(path.join(fontsDir, 'noto-sans-cyrillic-400.woff2'), 'NotoSansCyrillic');
    GlobalFonts.registerFromPath(path.join(fontsDir, 'noto-sans-cyrillic-700.woff2'), 'NotoSansCyrillic Bold');
    fontsRegistered = true;
}

// Простые векторные иконки (без иконочного шрифта) — по одной на тему
// карточки, рисуются обводкой внутри круглого бейджа.
const ICONS = {
    book(ctx, cx, cy, s, color) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.7);
        ctx.quadraticCurveTo(cx - s * 0.3, cy - s, cx - s, cy - s * 0.85);
        ctx.lineTo(cx - s, cy + s * 0.75);
        ctx.quadraticCurveTo(cx - s * 0.3, cy + s * 0.6, cx, cy + s * 0.85);
        ctx.quadraticCurveTo(cx + s * 0.3, cy + s * 0.6, cx + s, cy + s * 0.75);
        ctx.lineTo(cx + s, cy - s * 0.85);
        ctx.quadraticCurveTo(cx + s * 0.3, cy - s, cx, cy - s * 0.7);
        ctx.lineTo(cx, cy + s * 0.85);
        ctx.strokeStyle = color;
        ctx.lineWidth = s * 0.1;
        ctx.lineJoin = 'round';
        ctx.stroke();
    },
    shield(ctx, cx, cy, s, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = s * 0.09;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.quadraticCurveTo(cx + s * 0.9, cy - s * 0.7, cx + s * 0.9, cy - s * 0.1);
        ctx.quadraticCurveTo(cx + s * 0.9, cy + s * 0.75, cx, cy + s);
        ctx.quadraticCurveTo(cx - s * 0.9, cy + s * 0.75, cx - s * 0.9, cy - s * 0.1);
        ctx.quadraticCurveTo(cx - s * 0.9, cy - s * 0.7, cx, cy - s);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.35, cy);
        ctx.lineTo(cx - s * 0.1, cy + s * 0.3);
        ctx.lineTo(cx + s * 0.4, cy - s * 0.3);
        ctx.stroke();
    },
    chat(ctx, cx, cy, s, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = s * 0.1;
        ctx.lineJoin = 'round';
        const x = cx - s;
        const y = cy - s * 0.75;
        const r = s * 0.3;
        const w = s * 2;
        const h = s * 1.3;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.3, cy + s * 0.55);
        ctx.lineTo(cx - s * 0.55, cy + s);
        ctx.lineTo(cx, cy + s * 0.55);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    },
    mic(ctx, cx, cy, s, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = s * 0.1;
        ctx.lineJoin = 'round';
        const x = cx - s * 0.35;
        const y = cy - s;
        const r = s * 0.35;
        const w = s * 0.7;
        const h = s * 1.3;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.1, s * 0.75, Math.PI * 0.2, Math.PI * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.75);
        ctx.lineTo(cx, cy + s * 1.15);
        ctx.moveTo(cx - s * 0.4, cy + s * 1.15);
        ctx.lineTo(cx + s * 0.4, cy + s * 1.15);
        ctx.stroke();
    },
    lifebuoy(ctx, cx, cy, s, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = s * 0.22;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = s * 0.08;
        for (let i = 0; i < 4; i++) {
            const a = (Math.PI / 2) * i + Math.PI / 4;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5);
            ctx.lineTo(cx + Math.cos(a) * s * 1.1, cy + Math.sin(a) * s * 1.1);
            ctx.stroke();
        }
    },
    gavel(ctx, cx, cy, s, color) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 5);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.rect(-s * 0.9, -s * 0.3, s * 0.9, s * 0.45);
        ctx.fill();
        ctx.beginPath();
        ctx.rect(-s * 0.15, -s * 0.75, s * 0.35, s * 0.9);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.rect(cx - s * 0.15, cy + s * 0.55, s * 1.3, s * 0.2);
        ctx.fill();
    },
    alert(ctx, cx, cy, s, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = s * 0.12;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s * 0.95, cy + s * 0.8);
        ctx.lineTo(cx - s * 0.95, cy + s * 0.8);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.42, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.35);
        ctx.lineTo(cx, cy + s * 0.15);
        ctx.stroke();
    },
    check(ctx, cx, cy, s, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = s * 0.12;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.45, cy);
        ctx.lineTo(cx - s * 0.1, cy + s * 0.4);
        ctx.lineTo(cx + s * 0.5, cy - s * 0.35);
        ctx.stroke();
    },
};

function renderBanner(title, iconKey) {
    ensureFonts();
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#161a36');
    bgGrad.addColorStop(1, DARK);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 16; y < H; y += 22) {
        for (let x = 16; x < W; x += 22) {
            ctx.beginPath();
            ctx.arc(x, y, 1.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const glow = ctx.createRadialGradient(BADGE_CX, BADGE_CY, 0, BADGE_CX, BADGE_CY, 150);
    glow.addColorStop(0, 'rgba(88,101,242,0.6)');
    glow.addColorStop(1, 'rgba(88,101,242,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.beginPath();
    ctx.arc(BADGE_CX, BADGE_CY, 46, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(14,15,26,0.65)';
    ctx.fill();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const icon = ICONS[iconKey] ?? ICONS.book;
    icon(ctx, BADGE_CX, BADGE_CY, 24, '#ffffff');

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, 14);
    ctx.lineTo(14, 44);
    ctx.moveTo(14, 14);
    ctx.lineTo(44, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W - 14, H - 14);
    ctx.lineTo(W - 14, H - 44);
    ctx.moveTo(W - 14, H - 14);
    ctx.lineTo(W - 44, H - 14);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px NotoSansCyrillic';
    ctx.fillText('ПРАВИЛА', 215, H / 2 - 18);

    ctx.fillStyle = '#ffffff';
    ctx.font = '40px "NotoSansCyrillic Bold"';
    ctx.fillText(title, 215, H / 2 + 26);

    return canvas.toBuffer('image/png');
}

// title/iconKey — по одному на карточку, порядок и состав должны совпадать
// с rules/model.js buildCards(). Рендерятся лениво при первом обращении и
// кэшируются на весь процесс — контент баннеров не зависит ни от участника,
// ни от гильдии, пересчитывать их на каждый /rules незачем.
const BANNER_SPECS = [
    { title: 'Правила сервера', icon: 'book' },
    { title: 'Верификация', icon: 'shield' },
    { title: 'Поведение и общение', icon: 'chat' },
    { title: 'Голосовые и временные комнаты', icon: 'mic' },
    { title: 'Поддержка и предложения', icon: 'lifebuoy' },
    { title: 'Модерация', icon: 'gavel' },
    { title: 'Экстренная блокировка', icon: 'alert' },
    { title: 'Ответственность', icon: 'check' },
];

let cachedAttachments = null;
function getBannerAttachments() {
    if (!cachedAttachments) {
        cachedAttachments = BANNER_SPECS.map(({ title, icon }, i) => {
            const filename = `rules-banner-${i}.png`;
            return {
                filename,
                url: `attachment://${filename}`,
                attachment: new AttachmentBuilder(renderBanner(title, icon), { name: filename }),
            };
        });
    }
    return cachedAttachments;
}

module.exports = { getBannerAttachments };
