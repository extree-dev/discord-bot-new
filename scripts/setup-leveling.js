require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const leveling = require('../leveling');
const { findOrCreateChannel, findOrCreateRole } = require('../utils/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CATEGORY_NAME = '📋 Информация';
// Те же имена канала/ролей, что были у прежней системы репутации
// (scripts/setup-reputation.js, удалён) — findOrCreateChannel/
// findOrCreateRole ищут по сохранённому ID, а при его отсутствии по
// имени, так что этот скрипт узнаёт и усыновляет уже существующие на
// сервере канал и роли уровней вместо создания дублей, хотя у самой
// фичи leveling/ свежий config-store без единого сохранённого ID.
const CHANNEL_NAME = 'рейтинг';

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const existingGuildConfig = await leveling.getGuildConfig(guild.id);

        const { channel: category, created: categoryCreated } = await findOrCreateChannel({
            guild,
            existingId: existingGuildConfig.categoryId,
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
        });
        if (categoryCreated) console.log(`Создана категория: ${CATEGORY_NAME}`);

        const { channel, created: channelCreated } = await findOrCreateChannel({
            guild,
            existingId: existingGuildConfig.announceChannelId,
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            },
        });
        if (channelCreated) {
            console.log(`Создан канал: ${CHANNEL_NAME}`);
        } else {
            console.log(`Канал топа активности уже настроен: ${channel.name}`);
            await channel.permissionOverwrites
                .edit(guild.roles.everyone.id, { SendMessages: false })
                .catch(err => console.error('Не удалось закрыть канал от записи:', err.message));
        }

        // Роль на каждый ярус, включая стартовый "Новичок" (LEVELS[0]) —
        // выдаётся при верификации (security/verification.js), а не
        // при первом очке активности. Имя/цвет/гильдийные права
        // (LEVELS[].perks) синхронизируются с кодом при каждом деплое —
        // в отличие от категории/канала выше, эти роли полностью в
        // собственности бота (администратор их не переименовывает под
        // свои нужды), так что рассинхрон с кодом — всегда повод
        // поправить роль, а не чья-то осознанная ручная настройка.
        const levelRoles = {};
        for (let i = 0; i < leveling.LEVELS.length; i++) {
            const level = leveling.LEVELS[i];
            const { role, created: roleCreated } = await findOrCreateRole({
                guild,
                existingId: existingGuildConfig.levelRoles?.[i],
                name: level.title,
                color: level.color,
                hoist: true,
                mentionable: false,
                permissions: level.perks,
            });
            console.log(roleCreated ? `Создана роль яруса: ${level.title}` : `Роль яруса уже настроена: ${role.name}`);

            if (role.name !== level.title || role.color !== level.color) {
                await role
                    .edit({ name: level.title, color: level.color }, 'Синхронизация роли яруса уровня с кодом бота')
                    .catch(err => console.error(`Не удалось переименовать роль яруса ${level.title}:`, err.message));
            }
            const targetBits = level.perks.reduce((acc, bit) => acc | bit, 0n);
            if (role.permissions.bitfield !== targetBits) {
                await role
                    .setPermissions(level.perks, 'Синхронизация бонусов яруса уровня с кодом бота')
                    .catch(err => console.error(`Не удалось выставить права роли яруса ${level.title}:`, err.message));
            }

            levelRoles[i] = role.id;
        }

        // Разовая самоисцеляющаяся очистка: на прошлых деплоях сюда были
        // добавлены отдельные "клубные" голосовые/текстовые каналы для
        // ярусов Боец/Мастер (своя категория + войс Бойца + текст/войс
        // Мастера) — от них решено отказаться: лишняя, никем не просимая
        // инфраструктура, а функциональный бонус ярусу даёт сама роль
        // (LEVELS[].perks), без отдельных каналов. Если каналы уже
        // созданы прошлым деплоем — удаляем их с сервера, дальше
        // configureGuild() ниже стирает сохранённые ID из конфига; на
        // свежем сервере (существующих ID нет) блок ничего не делает.
        // Порядок важен: сперва дочерние каналы, категория — последней.
        const staleClubChannelIds = [
            existingGuildConfig.fighterVoiceChannelId,
            existingGuildConfig.masterTextChannelId,
            existingGuildConfig.masterVoiceChannelId,
            existingGuildConfig.clubCategoryId,
        ].filter(Boolean);
        for (const id of staleClubChannelIds) {
            const staleChannel = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
            if (!staleChannel) continue;
            const staleName = staleChannel.name;
            await staleChannel
                .delete('Отказ от клубных каналов ярусов уровня')
                .then(() => console.log(`Удалён клубный канал: ${staleName}`))
                .catch(err => console.error(`Не удалось удалить клубный канал ${staleName}:`, err.message));
        }

        // Нативная роль "Booster" (Discord создаёт её сам при первом
        // бусте сервера, ей нельзя управлять через findOrCreateRole) —
        // сразу открывает бонусы ярусов 5-50, без прокачки.
        const boosterRole = guild.roles.premiumSubscriberRole;
        if (boosterRole) {
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
        } else {
            console.log(
                'На сервере пока нет роли Booster (буста ещё не было) — бонусы 5-50 будут выданы ей автоматически на первом деплое после появления.'
            );
        }

        await leveling.configureGuild(guild.id, {
            channelId: channel.id,
            categoryId: category.id,
            levelRoles,
            clubCategoryId: null,
            fighterVoiceChannelId: null,
            masterTextChannelId: null,
            masterVoiceChannelId: null,
        });

        console.log('Готово. Топ активности публикуется автоматически раз в неделю в канал #' + CHANNEL_NAME + '.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки уровней активности:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
