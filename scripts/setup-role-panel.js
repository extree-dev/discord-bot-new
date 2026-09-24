require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const rolePanel = require('../rolePanel');
const gameNews = require('../gameNews');
const { GAMES } = require('../gameNews/games');
const { findRole } = require('../utils/idempotent');
const { ensureChannel, refreshPanel } = require('../utils/setupMode');
const { toMessage } = require('../utils/components');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Та же категория, что и у "рейтинг" (scripts/setup-leveling.js) —
// общий хаб самостоятельных информационных каналов.
const CATEGORY_NAME = '📋 Информация';
const CHANNEL_NAME = 'выбор-ролей';

// Возвращает кастомный эмодзи сервера по имени (game.customEmojiName —
// тот же, что и у игровой роли в scripts/add-onboarding-role-
// questions.js), если он есть — иначе юникод-эмодзи game.emoji.
// StringSelectMenu умеет показывать кастомные эмодзи (в отличие от
// названий каналов — там работает только юникод, см. gameNews/games.js),
// поэтому эта замена только для панели.
function resolveEmoji(guild, game) {
    if (game.customEmojiName) {
        const custom = guild.emojis.cache.find(e => e.name === game.customEmojiName);
        if (custom) return { id: custom.id, name: custom.name };
        console.warn(
            `Кастомный эмодзи ":${game.customEmojiName}:" не найден на сервере — для игры "${game.name}" в панели использую стандартный ${game.emoji}.`
        );
    }
    return game.emoji;
}

// Роли игр панель не создаёт — они уже заведены адаптацией
// (scripts/add-onboarding-role-questions.js), здесь только находим их
// по имени. Игра без найденной роли не попадает в панель совсем (не
// показываем участнику пункт меню, который ничего не сделает).
client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();
        await guild.emojis.fetch();

        const existing = await rolePanel.getConfig();

        const { channel: category, created: categoryCreated } = await ensureChannel({
            guild,
            existingId: existing.categoryId,
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
        });
        if (categoryCreated) console.log(`Создана категория: ${CATEGORY_NAME}`);

        // Как и у остальных scripts/setup-*.js (см. utils/setupMode.js):
        // отсутствие канала в режиме синхронизации — это не ошибка деплоя,
        // а нормальное состояние до первого ручного --bootstrap. Раньше
        // здесь был process.exit(1), из-за чего деплой падал целиком на
        // каждом прогоне до тех пор, пока администратор не запустит
        // --bootstrap вручную (см. CHANGELOG).
        const { channel, created } = await ensureChannel({
            guild,
            existingId: existing.channelId,
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            parentId: category?.id,
        });
        if (created) console.log(`Создан канал: ${CHANNEL_NAME}`);

        const roleIds = { ...existing.roleIds };
        const availableGames = [];
        for (const game of GAMES) {
            const role = findRole({ guild, existingId: existing.roleIds[game.key], name: game.name });
            if (!role) {
                console.warn(`Роль "${game.name}" не найдена — игра не попадёт в панель выбора ролей.`);
                continue;
            }
            roleIds[game.key] = role.id;
            availableGames.push({ ...game, emoji: resolveEmoji(guild, game) });
        }

        // Роли-пинги новостей создаёт scripts/setup-game-news.js
        // (запускается перед этим скриптом в деплое) — здесь только
        // читаем уже сохранённые ID, сами роли не ищем и не создаём.
        const newsRoleIds = (await gameNews.getConfig()).newsRoleIds;
        const availableNewsGames = GAMES.filter(game => newsRoleIds[game.key]).map(game => ({
            ...game,
            emoji: resolveEmoji(guild, game),
        }));

        await rolePanel.saveTargets({
            categoryId: category?.id ?? existing.categoryId,
            channelId: channel?.id ?? existing.channelId,
            roleIds,
        });

        if (!channel) {
            console.warn('Канал панели не найден — панель не опубликована.');
            process.exit(0);
        }
        if (availableGames.length === 0 && availableNewsGames.length === 0) {
            console.warn('Ни одна роль (игровая или новостная) не найдена — панель не опубликована.');
            process.exit(0);
        }

        await refreshPanel({
            channel,
            botId: client.user.id,
            payload: toMessage(
                rolePanel.buildPanelMessage({ playGames: availableGames, newsGames: availableNewsGames })
            ),
            label: 'Панель выбора игровых ролей',
        });

        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки панели выбора игровых ролей:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
