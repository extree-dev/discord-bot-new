// Карточка профиля уровня активности — одна картинка (баннер профиля как
// фон, круглый аватар, имя/уровень/счёт/полоса прогресса, место в
// рейтинге), а не embed/Components V2 с текстом. Все данные (буферы
// аватара/баннера/иконки сервера, собранные из Discord CDN) передаются
// готовыми — сама функция рисования не трогает сеть и не трогает Discord
// API, поэтому тестируется отдельно (см. leveling/model.js
// buildRankCardAttachment(), где буферы собираются).
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { COLORS } = require('../utils/embeds');
const { ensureFonts, roundedRectPath, drawCircleImage, truncate, formatVoiceMinutes } = require('./canvasUtils');

const WIDTH = 900;
const HEIGHT = 270;
const AVATAR_SIZE = 150;
const AVATAR_X = 60;
const AVATAR_Y = (HEIGHT - AVATAR_SIZE) / 2;
const TEXT_X = AVATAR_X + AVATAR_SIZE + 40;
const PRIMARY_HEX = `#${COLORS.primary.toString(16).padStart(6, '0')}`;

// Золото/серебро/бронза для топ-3 в рейтинге — остальным местам просто
// белый текст, как раньше.
const RANK_MEDAL_COLORS = { 1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32' };

const GUILD_ICON_SIZE = 28;
const GUILD_ICON_X = 16;
const GUILD_ICON_Y = 16;
const GUILD_NAME_MAX_CHARS = 28;

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

function drawProgressBar(ctx, x, y, w, h, progress, colorHex) {
    const clamped = Math.max(0, Math.min(1, progress));
    roundedRectPath(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();

    if (clamped > 0) {
        const filledWidth = Math.max(h, w * clamped);
        roundedRectPath(ctx, x, y, filledWidth, h, h / 2);
        ctx.fillStyle = colorHex;
        ctx.fill();
    }
}

// avatarBuffer/bannerBuffer/guildIconBuffer — PNG/JPEG Buffer или null
// (у пользователя может не быть баннера вообще — тогда фон заменяет
// градиент; guildIconBuffer отсутствует — просто не рисуем иконку сервера
// в уголке, только имя, если оно передано).
async function renderRankCard({
    displayName,
    avatarBuffer,
    bannerBuffer,
    level,
    score,
    rank,
    messageCount,
    voiceMinutes,
    guildName,
    guildIconBuffer,
}) {
    ensureFonts();
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Акцент карточки растёт вместе с уровнем (level.color из
    // leveling/model.js LEVELS — тот же цвет, что у роли уровня на
    // сервере) — кольцо аватара и полоса прогресса красятся им вместо
    // одного статичного PRIMARY_HEX на все уровни. level.color может
    // отсутствовать (старые вызовы/тесты без него) — тогда просто
    // используем цвет бренда бота, как раньше.
    const accentHex = typeof level?.color === 'number' ? `#${level.color.toString(16).padStart(6, '0')}` : PRIMARY_HEX;

    if (bannerBuffer) {
        const banner = await loadImage(bannerBuffer);
        drawImageCover(ctx, banner, 0, 0, WIDTH, HEIGHT);
    } else {
        const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
        gradient.addColorStop(0, accentHex);
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
        drawCircleImage(ctx, avatar, avatarCenterX, avatarCenterY, AVATAR_SIZE);
    }
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, AVATAR_SIZE / 2 + 3, 0, Math.PI * 2);
    ctx.strokeStyle = accentHex;
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

    drawProgressBar(ctx, TEXT_X, 148, WIDTH - TEXT_X - 60, 26, level.progress, accentHex);

    // Вторая строка статистики под полосой: слева — сколько очков осталось
    // до следующего уровня (на максимуме — что расти уже некуда), справа —
    // из чего набран счёт (сообщения + голос) — активность, а не только
    // итоговое число.
    ctx.font = '16px NotoSansCyrillic';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.textAlign = 'left';
    const remainingLabel = level.next
        ? `Осталось: ${Math.max(0, level.next.min - score)} очков`
        : 'Максимальный уровень';
    ctx.fillText(remainingLabel, TEXT_X, 200);
    ctx.textAlign = 'right';
    ctx.fillText(
        `Сообщений: ${messageCount ?? 0} · В голосовых: ${formatVoiceMinutes(voiceMinutes ?? 0)}`,
        WIDTH - 60,
        200
    );
    ctx.textAlign = 'left';

    if (rank) {
        ctx.font = '26px "NotoSansCyrillic Bold"';
        ctx.fillStyle = RANK_MEDAL_COLORS[rank] ?? '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(`#${rank}`, WIDTH - 30, 45);
        ctx.textAlign = 'left';
    }

    // Уголок с брендингом сервера — маленькая круглая иконка + имя, не
    // конкурирует с основной информацией о профиле. Рисуется, только если
    // есть хотя бы имя (иконка у сервера может отсутствовать).
    if (guildName) {
        let textX = GUILD_ICON_X;
        if (guildIconBuffer) {
            const icon = await loadImage(guildIconBuffer);
            drawCircleImage(
                ctx,
                icon,
                GUILD_ICON_X + GUILD_ICON_SIZE / 2,
                GUILD_ICON_Y + GUILD_ICON_SIZE / 2,
                GUILD_ICON_SIZE
            );
            textX = GUILD_ICON_X + GUILD_ICON_SIZE + 10;
        }
        ctx.font = '16px NotoSansCyrillic';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillText(truncate(guildName, GUILD_NAME_MAX_CHARS), textX, GUILD_ICON_Y + GUILD_ICON_SIZE / 2 + 6);
    }

    return canvas.toBuffer('image/png');
}

module.exports = { renderRankCard, WIDTH, HEIGHT };
