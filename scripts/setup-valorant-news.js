require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits } = require('discord.js');
const valorantNews = require('../valorantNews');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Канал #📬│game-news — уже существующий на сервере канал для игровых
// новостей (не бот-управляемый, ID пришёл напрямую от администратора), не
// #📰│новости-сервера (тот у changelog/ — про релизы бота и объявления
// администрации, начиная с этого пиннинга больше не используется для
// новостей Valorant). Тот же приём, что у ADMIN_ROLE_ID в
// scripts/setup-roles.js — пиним готовый ID константой вместо поиска по
// имени/создания.
const GAME_NEWS_CHANNEL_ID = '1550163038517334188';

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();

        const channel = guild.channels.cache.get(GAME_NEWS_CHANNEL_ID);
        if (!channel) {
            console.error(
                `Канал с ID ${GAME_NEWS_CHANNEL_ID} (ожидался #📬│game-news) не найден на сервере — проверь GAME_NEWS_CHANNEL_ID в scripts/setup-valorant-news.js.`
            );
            process.exit(1);
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
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки новостей Valorant:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
