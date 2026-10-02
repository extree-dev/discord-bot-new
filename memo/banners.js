// Баннеры-картинки для карточек памятки — тот же стиль "F", что и у
// rules/banners.js (общая отрисовка в utils/canvasBanner.js), свой набор
// карточек и свой подписанный лейбл.
const { AttachmentBuilder } = require('discord.js');
const { renderBannerPng } = require('../utils/canvasBanner');

// Порядок и состав должны совпадать с memo/model.js buildCards().
const BANNER_SPECS = [
    { title: 'Добро пожаловать', icon: 'book' },
    { title: 'Каналы сервера', icon: 'info' },
    { title: 'Поддержка', icon: 'lifebuoy' },
    { title: 'Команды бота', icon: 'command' },
    { title: 'Роли', icon: 'role' },
    { title: 'Голосовые комнаты', icon: 'mic' },
];

let cachedAttachments = null;
function getBannerAttachments() {
    if (!cachedAttachments) {
        cachedAttachments = BANNER_SPECS.map(({ title, icon }, i) => {
            const filename = `memo-banner-${i}.png`;
            return {
                filename,
                url: `attachment://${filename}`,
                attachment: new AttachmentBuilder(renderBannerPng(title, icon, 'ПАМЯТКА'), { name: filename }),
            };
        });
    }
    return cachedAttachments;
}

module.exports = { getBannerAttachments };
