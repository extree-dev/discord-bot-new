require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits } = require('discord.js');
const valorantNews = require('../valorantNews');

// Канал #📬│game-news — уже существующий на сервере канал для игровых
// новостей (не бот-управляемый, ID пришёл напрямую от администратора), не
// #📰│новости-сервера (тот у changelog/ — про релизы бота и объявления
// администрации, начиная с этого пиннинга больше не используется для
// новостей Valorant). Тот же приём, что у ADMIN_ROLE_ID в
// scripts/setup-roles.js — пиним готовый ID константой вместо поиска по
// имени/создания.
const GAME_NEWS_CHANNEL_ID = '1550163038517334188';

async function run(client) {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();

        const channel = guild.channels.cache.get(GAME_NEWS_CHANNEL_ID);
        if (!channel) {
            console.error(
                `Канал с ID ${GAME_NEWS_CHANNEL_ID} (ожидался #📬│game-news) не найден на сервере — проверь GAME_NEWS_CHANNEL_ID в scripts/setup-valorant-news.js.`
            );
            return false;
        }

        const existing = await valorantNews.getConfig();
        if (existing.channelId !== channel.id) {
            await valorantNews.saveChannel(channel.id);
            console.log(`Канал для новостей Valorant сохранён: ${channel.name} (${channel.id}).`);
        } else {
            console.log('Канал для новостей Valorant уже настроен.');
        }

        console.log(
            process.env.HENRIKDEV_API_KEY
                ? 'HENRIKDEV_API_KEY найден — публикация новостей включена.'
                : 'HENRIKDEV_API_KEY не задан в .env — публикация новостей будет молча простаивать, пока ключ не появится.'
        );
        return true;
    } catch (err) {
        console.error('Ошибка настройки новостей Valorant:', err);
        return false;
    }
}

module.exports = run;

if (require.main === module) {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    client.once('clientReady', async () => {
        const ok = await run(client);
        process.exit(ok ? 0 : 1);
    });
    client.login(process.env.DISCORD_TOKEN);
}
