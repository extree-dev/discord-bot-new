require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits } = require('discord.js');
const changelog = require('../changelog');
const valorantNews = require('../valorantNews');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Свой независимый config-store (valorantNews/config.js), но канал у него
// тот же, что и у changelog/ — #📰│новости-сервера (см. PR про
// переименование #обновления). Читаем уже сохранённый channelId у
// changelog/, а не ищем канал заново по имени — тот же приём, что у
// scripts/setup-onboarding.js с чужими каналами.
client.once('clientReady', async () => {
    try {
        const { channelId } = await changelog.getConfig();
        if (!channelId) {
            console.warn(
                'Канал новостей сервера ещё не настроен (changelog/) — запусти сначала scripts/setup-changelog.js.'
            );
            process.exit(0);
        }

        const existing = await valorantNews.getConfig();
        if (existing.channelId !== channelId) {
            await valorantNews.saveChannel(channelId);
            console.log('Канал для новостей Valorant сохранён (тот же, что #новости-сервера).');
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
