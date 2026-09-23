require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits } = require('discord.js');
const valorantNews = require('../valorantNews');

// Канал #📬│esports-news и роль для пинга киберспорта уже созданы
// администратором на сервере — ID пришли напрямую от него (тот же приём,
// что GAME_NEWS_CHANNEL_ID в setup-valorant-news.js). Скрипт только
// проверяет, что они есть, и сохраняет ID в конфиг valorantNews/esports.
const ESPORTS_CHANNEL_ID = '1551626467560005664';
const ESPORTS_PING_ROLE_ID = '1552385549329899641';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();
        await guild.roles.fetch();

        const channel = guild.channels.cache.get(ESPORTS_CHANNEL_ID);
        if (!channel) {
            console.error(`Канал киберспорта с ID ${ESPORTS_CHANNEL_ID} не найден на сервере.`);
            process.exit(1);
        }
        const role = guild.roles.cache.get(ESPORTS_PING_ROLE_ID);
        if (!role) console.warn(`Роль с ID ${ESPORTS_PING_ROLE_ID} не найдена — публикую без пинга.`);

        const existing = await valorantNews.getEsportsConfig();
        const pingRoleId = role?.id ?? null;
        if (existing.channelId !== channel.id || existing.pingRoleId !== pingRoleId) {
            await valorantNews.saveEsportsTargets({ channelId: channel.id, pingRoleId });
            console.log(`Киберспорт: канал ${channel.name}, роль ${role?.name ?? 'без пинга'} — сохранено.`);
        } else {
            console.log('Киберспорт: канал и роль уже настроены.');
        }
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки киберспорта:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
