require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const reputation = require('../reputation');
const { findOrCreateChannel, findOrCreateRole } = require('./lib/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CATEGORY_NAME = '📋 Информация';
const CHANNEL_NAME = 'рейтинг';

// Цвет роли растёт по "теплоте" вместе с уровнем — тот же принцип, что
// и у SPECIALIST_ROLES в setup-tickets.js (цвет несёт смысл, не просто
// украшение). По одному цвету на каждый уровень, включая стартовый
// "Новичок" (LEVELS[0]) — роль выдаётся уже с первого очка репутации.
const LEVEL_ROLE_COLORS = [0x99aab5, 0x2ecc71, 0x3498db, 0x9b59b6, 0xe67e22, 0xe91e63, 0xf1c40f];

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const existingGuildConfig = await reputation.getGuildConfig(guild.id);

        let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME);
        if (!category) {
            category = await guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory });
            console.log(`Создана категория: ${CATEGORY_NAME}`);
        }

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
            console.log(`Канал рейтинга уже настроен: ${channel.name}`);
            await channel.permissionOverwrites
                .edit(guild.roles.everyone.id, { SendMessages: false })
                .catch(err => console.error('Не удалось закрыть канал от записи:', err.message));
        }

        // Роль на каждый уровень, включая стартовый "Новичок" (LEVELS[0]) —
        // выдаётся уже с первого очка репутации (см. giveReputation().firstPoint).
        const levelRoles = {};
        for (let i = 0; i < reputation.LEVELS.length; i++) {
            const level = reputation.LEVELS[i];
            const { role, created: roleCreated } = await findOrCreateRole({
                guild,
                existingId: existingGuildConfig.levelRoles?.[i],
                name: level.title,
                color: LEVEL_ROLE_COLORS[i] ?? 0x99aab5,
                hoist: true,
                mentionable: false,
                permissions: [],
            });
            console.log(
                roleCreated ? `Создана роль уровня: ${level.title}` : `Роль уровня уже настроена: ${role.name}`
            );
            levelRoles[i] = role.id;
        }

        await reputation.configureGuild(guild.id, { channelId: channel.id, levelRoles });

        console.log('Готово. Рейтинг публикуется автоматически раз в неделю в канал #' + CHANNEL_NAME + '.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки репутации:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
