require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const gameNews = require('../gameNews');
const { newsRoleName } = require('../gameNews/games');
const { isBootstrap, ensureChannel, ensureRole } = require('../utils/setupMode');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CATEGORY_NAME = '🎮 Новости игр';

// По прямому запросу администратора: отдельный канал на каждую игру из
// пула ролей (scripts/add-onboarding-role-questions.js), пока пустой —
// туда планируется подключить публикацию новостей через Steam API
// (gameNews/games.js — общий список игр для обеих фич). Название канала
// повторяет эмодзи роли из ROLE_CATEGORIES, чтобы канал было легко
// узнать в списке.
client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();
        await guild.roles.fetch();

        const existing = await gameNews.getConfig();

        const { channel: category, created: categoryCreated } = await ensureChannel({
            guild,
            existingId: existing.categoryId,
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
        });
        if (categoryCreated) console.log(`Создана категория: ${CATEGORY_NAME}`);

        const channels = { ...existing.channels };
        const newsRoleIds = { ...existing.newsRoleIds };
        for (const game of gameNews.GAMES) {
            const { channel, created } = await ensureChannel({
                guild,
                existingId: existing.channels[game.key],
                name: `${game.emoji}│${game.slug}`,
                type: ChannelType.GuildText,
                parentId: category?.id,
                createOptions: {
                    topic: `Новости ${game.name} (пока пусто — публикация появится вместе с интеграцией Steam API)`,
                    permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
                },
            });
            if (channel) {
                channels[game.key] = channel.id;
                console.log(
                    created ? `Создан канал новостей: ${channel.name}` : `Канал новостей уже настроен: ${channel.name}`
                );
            }

            // Отдельная декоративная роль-пинг (не совпадает с игровой
            // ролью "играю в это" из адаптации) — самостоятельно
            // выбирается в rolePanel/, будущая интеграция Steam API будет
            // упоминать её в публикации, чтобы пинговать только тех, кому
            // интересна конкретная игра.
            const { role, created: roleCreated } = await ensureRole({
                guild,
                existingId: existing.newsRoleIds[game.key],
                name: newsRoleName(game),
                color: game.color,
                hoist: false,
                mentionable: true,
            });
            if (role) {
                newsRoleIds[game.key] = role.id;
                console.log(roleCreated ? `Создана роль-пинг: ${role.name}` : `Роль-пинг уже настроена: ${role.name}`);
            }
        }

        await gameNews.saveTargets({ categoryId: category?.id ?? existing.categoryId, channels, newsRoleIds });

        console.log(
            isBootstrap()
                ? 'Готово. Каналы созданы и пока пустые — публикация новостей подключится отдельно (Steam API).'
                : 'Готово. Синхронизация с существующими каналами завершена.'
        );
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки каналов новостей игр:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
