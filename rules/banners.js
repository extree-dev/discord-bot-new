// Баннеры-картинки для карточек правил (стиль "F", выбранный администратором
// из нескольких вариантов) — сама отрисовка вынесена в общий
// utils/canvasBanner.js (тем же стилем теперь рисует и memo/banners.js),
// здесь только список карточек rules/ и кэш готовых PNG на процесс.
const { AttachmentBuilder } = require('discord.js');
const { renderBannerPng } = require('../utils/canvasBanner');

// title/icon — по одному на карточку, порядок и состав должны совпадать
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
                attachment: new AttachmentBuilder(renderBannerPng(title, icon, 'ПРАВИЛА'), { name: filename }),
            };
        });
    }
    return cachedAttachments;
}

module.exports = { getBannerAttachments };
