require('dotenv').config({ quiet: true });
const leveling = require('../leveling');

// Разовая ручная правка (как scripts/fix-info-verification-ids.js — не
// входит в scripts/setup-*.js и не гоняется на каждом деплое, запускать
// один раз вручную через
// `docker compose run --rm bot node scripts/fix-leveling-ids.js`).
//
// leveling/ (замена reputation/, см. CHANGELOG) стартовала со свежим
// config-store без единого сохранённого ID — scripts/setup-leveling.js
// на первом деплое должен был найти уже существующие категорию
// "📋 Информация" и канал "рейтинг" по имени (тот же канал, которым
// раньше пользовалась reputation/), но категория к этому моменту была,
// судя по всему, переименована администратором вручную — у rules/ и
// changelog/ это никогда не всплывало, потому что они всегда используют
// уже сохранённый настоящий ID напрямую, а не поиск по имени. Поиск по
// имени категорию не нашёл, и scripts/setup-leveling.js создал рядом
// дубликат категории "📋 Информация" и дубликат канала "рейтинг" (сам
// канал внутри новой категории — findOrCreateChannel ищет канал только
// среди детей уже найденной/созданной категории). ID ниже — настоящие
// ID тех же ресурсов, что уже были восстановлены для reputation/ в
// scripts/fix-info-verification-ids.js: сам физический канал "рейтинг"
// никуда не делся при удалении фичи reputation/, поменялся только код,
// который на него ссылался.
const REAL_IDS = {
    infoCategoryId: '1549124339125715076',
    ratingChannelId: '1550503844188913686',
};

async function main() {
    const guildId = process.env.GUILD_ID;
    if (!guildId) throw new Error('GUILD_ID не задан в окружении.');

    // levelRoles не трогаем (undefined) — роли уровней дублей не имели
    // (findOrCreateRole нашёл их по имени успешно, без эмодзи в имени
    // рассинхрона не было), configureGuild пропускает поле, если оно
    // undefined.
    await leveling.configureGuild(guildId, {
        channelId: REAL_IDS.ratingChannelId,
        categoryId: REAL_IDS.infoCategoryId,
    });
    console.log('leveling: channelId и categoryId прописаны на реальные ресурсы.');
    console.log(
        'Готово. Сегодняшние дубликаты (категория "📋 Информация" и канал "рейтинг", созданные при первом деплое leveling/) больше не используются конфигом — их можно удалить вручную.'
    );
    process.exit(0);
}

main().catch(err => {
    console.error('Ошибка:', err);
    process.exit(1);
});
