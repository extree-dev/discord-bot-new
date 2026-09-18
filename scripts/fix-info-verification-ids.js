require('dotenv').config({ quiet: true });
const rules = require('../rules');
const changelog = require('../changelog');
const security = require('../security');
const reputation = require('../reputation');

// Разовая ручная правка (как migrate-json-to-postgres.js — не входит в
// scripts/setup-*.js и не гоняется на каждом деплое, запускать один раз
// вручную через `docker compose run --rm bot node scripts/fix-info-verification-ids.js`).
//
// После 3.9.2 категории "📋 Информация"/"🚪 Верификация" и каналы
// правила/обновления/рейтинг/verification были случайно созданы заново:
// сохранённых ID для них ещё не было (первый запуск с этим полем в
// конфиге), а старые реальные ресурсы к этому моменту администратор уже
// переименовал вручную при прошлых чистках дублей — поиск по дефолтному
// имени их не нашёл. ID ниже — актуальные ID настоящих, используемых
// ресурсов на сервере (получены от администратора вручную через Discord:
// Режим разработчика → ПКМ → Копировать ID).
const REAL_IDS = {
    infoCategoryId: '1549124339125715076',
    verificationCategoryId: '1549131490158444544',
    rulesChannelId: '1549124340681810010',
    changelogChannelId: '1550502650758434886',
    reputationChannelId: '1550503844188913686',
    verificationChannelId: '1549131497028591747',
};

async function main() {
    const guildId = process.env.GUILD_ID;
    if (!guildId) throw new Error('GUILD_ID не задан в окружении.');

    // messageId сбрасывается в null — раз channelId был потерян, вместе с
    // ним почти наверняка был потерян и messageId (сохраняются одной
    // операцией). setup-rules.js на следующем запуске просто опубликует и
    // закрепит правила заново в правильном канале, если не найдёт старое
    // сообщение.
    await rules.savePostedLocation(REAL_IDS.rulesChannelId, null);
    await rules.saveCategoryId(REAL_IDS.infoCategoryId);
    console.log('rules: channelId и categoryId прописаны на реальные ресурсы.');

    await changelog.saveChannel(REAL_IDS.changelogChannelId, REAL_IDS.infoCategoryId);
    console.log('changelog: channelId и categoryId прописаны на реальные ресурсы.');

    // levelRoles не трогаем (undefined) — роли уровней дублей не имели,
    // configureGuild пропускает поле, если оно undefined.
    await reputation.configureGuild(guildId, {
        channelId: REAL_IDS.reputationChannelId,
        categoryId: REAL_IDS.infoCategoryId,
    });
    console.log('reputation: channelId и categoryId прописаны на реальные ресурсы.');

    await security.updateConfig(config => {
        config.verification.categoryId = REAL_IDS.verificationCategoryId;
        config.verification.channelId = REAL_IDS.verificationChannelId;
    });
    console.log('verification: channelId и categoryId прописаны на реальные ресурсы.');

    console.log(
        'Готово. Сегодняшние дубликаты (категории/каналы с плашкой "НОВОЕ") больше не используются конфигом — их можно удалить вручную.'
    );
    process.exit(0);
}

main().catch(err => {
    console.error('Ошибка:', err);
    process.exit(1);
});
