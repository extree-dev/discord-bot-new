require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const leveling = require('../leveling');
const security = require('../security');
const tickets = require('../tickets');
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

// Клубные каналы для ярусов с канальными бонусами (Боец/Мастер) — своя
// отдельная категория, не общая с рейтингом/правилами/обновлениями:
// именно шаринг категории "📋 Информация" между фичами и стал причиной
// дублирования при первом деплое leveling/ (см. scripts/fix-leveling-ids.js
// и CHANGELOG) — здесь эта категория целиком в собственности leveling/,
// делить её больше не с кем.
const CLUB_CATEGORY_NAME = '🏆 Клубы уровней';
const FIGHTER_VOICE_NAME = '🔥│Клуб «Боец»';
const MASTER_TEXT_NAME = '👑│Клуб «Мастер»';
const MASTER_VOICE_NAME = '👑│ГК «Мастер»';

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const existingGuildConfig = await leveling.getGuildConfig(guild.id);
        const securityConfig = await security.getConfig();
        const ticketsConfig = await tickets.getConfig();

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
        // выдаётся при верификации (см. security/verification.js), а не
        // при первом очке активности. Имя/цвет/гильдийные права
        // (LEVELS[].perks) синхронизируются с кодом при каждом деплое —
        // в отличие от категории/канала выше, эти роли полностью в
        // собственности бота (администратор их не переименовывает под
        // свои нужды), так что рассинхрон с кодом — всегда повод
        // поправить роль, а не чья-то осознанная ручная настройка.
        const levelRoles = {};
        const levelRoleObjects = {};
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
            levelRoleObjects[level.title] = role;
        }

        // Клубные каналы — доступны Бойцам/Мастерам "по накоплению" (роли
        // ярусов складываются, см. leveling/model.js grantLevelRolesUpTo),
        // поэтому достаточно оверрайта только на роль своего яруса — все
        // более высокие ярусы её тоже держат.
        const { channel: clubCategory, created: clubCategoryCreated } = await findOrCreateChannel({
            guild,
            existingId: existingGuildConfig.clubCategoryId,
            name: CLUB_CATEGORY_NAME,
            type: ChannelType.GuildCategory,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }],
            },
        });
        if (clubCategoryCreated) console.log(`Создана категория: ${CLUB_CATEGORY_NAME}`);

        const fighterRole = levelRoleObjects['Боец'];
        const { channel: fighterVoice, created: fighterVoiceCreated } = await findOrCreateChannel({
            guild,
            existingId: existingGuildConfig.fighterVoiceChannelId,
            name: FIGHTER_VOICE_NAME,
            type: ChannelType.GuildVoice,
            parentId: clubCategory.id,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: fighterRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
                ],
            },
        });
        console.log(
            fighterVoiceCreated
                ? `Создан канал: ${FIGHTER_VOICE_NAME}`
                : `Канал клуба «Боец» уже настроен: ${fighterVoice.name}`
        );

        // "Приватный ГК и чат с модераторами" для Мастера — доступ
        // модерации нужен явно (эти каналы не под общей открытой
        // категорией, где у staff могло бы быть право видеть всё через
        // Administrator) — берём те же роли, что уже используются как
        // "штат" в других местах бота (security.baseRoleIds,
        // tickets.supportRoleId), а не изобретаем отдельный список.
        const masterRole = levelRoleObjects['Мастер'];
        const staffRoleIds = [
            securityConfig.baseRoleIds?.Admin,
            securityConfig.baseRoleIds?.Moderator,
            securityConfig.baseRoleIds?.['Beta-Moderator'],
            ticketsConfig.supportRoleId,
        ].filter(Boolean);

        const { channel: masterText, created: masterTextCreated } = await findOrCreateChannel({
            guild,
            existingId: existingGuildConfig.masterTextChannelId,
            name: MASTER_TEXT_NAME,
            type: ChannelType.GuildText,
            parentId: clubCategory.id,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: masterRole.id, allow: [PermissionFlagsBits.ViewChannel] },
                    ...staffRoleIds.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel] })),
                ],
            },
        });
        console.log(
            masterTextCreated
                ? `Создан канал: ${MASTER_TEXT_NAME}`
                : `Текстовый канал клуба «Мастер» уже настроен: ${masterText.name}`
        );

        const { channel: masterVoice, created: masterVoiceCreated } = await findOrCreateChannel({
            guild,
            existingId: existingGuildConfig.masterVoiceChannelId,
            name: MASTER_VOICE_NAME,
            type: ChannelType.GuildVoice,
            parentId: clubCategory.id,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: masterRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
                    ...staffRoleIds.map(id => ({
                        id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                    })),
                ],
            },
        });
        console.log(
            masterVoiceCreated
                ? `Создан канал: ${MASTER_VOICE_NAME}`
                : `Голосовой канал клуба «Мастер» уже настроен: ${masterVoice.name}`
        );

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
            clubCategoryId: clubCategory.id,
            fighterVoiceChannelId: fighterVoice.id,
            masterTextChannelId: masterText.id,
            masterVoiceChannelId: masterVoice.id,
        });

        console.log('Готово. Топ активности публикуется автоматически раз в неделю в канал #' + CHANNEL_NAME + '.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки уровней активности:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
