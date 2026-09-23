require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const leveling = require('../leveling');
const { findChannel } = require('../utils/idempotent');
const { isBootstrap, ensureChannel, ensureRole } = require('../utils/setupMode');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CATEGORY_NAME = '📋 Информация';
// Те же имена канала/ролей, что были у прежней системы репутации — поиск
// по сохранённому ID, а при его отсутствии по имени, так что скрипт
// узнаёт уже существующие канал и роли уровней вместо создания дублей.
const CHANNEL_NAME = 'рейтинг';

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const existingGuildConfig = await leveling.getGuildConfig(guild.id);

        const { channel: category, created: categoryCreated } = await ensureChannel({
            guild,
            existingId: existingGuildConfig.categoryId,
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
        });
        if (categoryCreated) console.log(`Создана категория: ${CATEGORY_NAME}`);

        // Канал автоматически не создаётся (по прямому запросу
        // администратора) — только поиск по сохранённому ID/имени.
        const channel = category
            ? await findChannel({
                  guild,
                  existingId: existingGuildConfig.announceChannelId,
                  name: CHANNEL_NAME,
                  type: ChannelType.GuildText,
                  parentId: category.id,
              })
            : null;
        if (channel) {
            console.log(`Канал топа активности уже настроен: ${channel.name}`);
            if (isBootstrap()) {
                await channel.permissionOverwrites
                    .edit(guild.roles.everyone.id, { SendMessages: false })
                    .catch(err => console.error('Не удалось закрыть канал от записи:', err.message));
            }
        } else {
            console.warn(
                `Канал "${CHANNEL_NAME}" не найден — автосоздание отключено администратором. Создай канал вручную, конфиг подхватит его по имени на следующем деплое.`
            );
        }

        // Роль на каждый ярус, включая стартовый "Новичок" (LEVELS[0]) —
        // выдаётся при верификации (security/verification.js). Имя/цвет/
        // права (LEVELS[].perks) приводятся к коду только при --bootstrap:
        // раньше каждый деплой перезаписывал их поверх ручных правок.
        const levelRoles = { ...existingGuildConfig.levelRoles };
        for (let i = 0; i < leveling.LEVELS.length; i++) {
            const level = leveling.LEVELS[i];
            const { role, created: roleCreated } = await ensureRole({
                guild,
                existingId: existingGuildConfig.levelRoles?.[i],
                name: level.title,
                color: level.color,
                hoist: true,
                mentionable: false,
                permissions: level.perks,
            });
            if (!role) continue;
            console.log(roleCreated ? `Создана роль яруса: ${level.title}` : `Роль яруса уже настроена: ${role.name}`);

            if (isBootstrap()) {
                if (role.name !== level.title || role.color !== level.color) {
                    await role
                        .edit({ name: level.title, color: level.color }, 'Синхронизация роли яруса уровня с кодом бота')
                        .catch(err =>
                            console.error(`Не удалось переименовать роль яруса ${level.title}:`, err.message)
                        );
                }
                const targetBits = level.perks.reduce((acc, bit) => acc | bit, 0n);
                if (role.permissions.bitfield !== targetBits) {
                    await role
                        .setPermissions(level.perks, 'Синхронизация бонусов яруса уровня с кодом бота')
                        .catch(err =>
                            console.error(`Не удалось выставить права роли яруса ${level.title}:`, err.message)
                        );
                }
            }

            levelRoles[i] = role.id;
        }

        // Нативная роль "Booster" (Discord создаёт её сам при первом бусте) —
        // бонусы ярусов 5-50 без прокачки. Права выставляются только при
        // --bootstrap, чтобы деплой не перезаписывал ручные правки роли.
        const boosterRole = guild.roles.premiumSubscriberRole;
        if (isBootstrap() && boosterRole) {
            const boosterPerks = leveling.getBoosterBundlePermissions();
            const targetBits = boosterPerks.reduce((acc, bit) => acc | bit, 0n);
            if (boosterRole.permissions.bitfield !== targetBits) {
                await boosterRole
                    .setPermissions(boosterPerks, 'Бонусы ярусов 5-50 для бустеров сервера')
                    .catch(err => console.error('Не удалось выставить права роли Booster:', err.message));
                console.log('Роли Booster выданы бонусы ярусов 5-50.');
            } else {
                console.log('Роль Booster уже настроена на бонусы ярусов 5-50.');
            }
        }

        await leveling.configureGuild(guild.id, {
            channelId: channel?.id ?? existingGuildConfig.announceChannelId,
            categoryId: category?.id,
            levelRoles,
        });

        console.log('Готово. Топ активности публикуется автоматически раз в неделю в канал #' + CHANNEL_NAME + '.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки уровней активности:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
