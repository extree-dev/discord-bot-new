require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const modqueue = require('../modqueue');
const security = require('../security');
const tickets = require('../tickets');
const { findOrCreateChannel } = require('../utils/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CHANNEL_NAME = '🛡️│очередь-модерации';

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = await modqueue.getConfig();
        const securityConfig = await security.getConfig();
        const ticketsConfig = await tickets.getConfig();

        // Канал видят только модераторы (Admin/Moderator/Beta-Moderator/
        // Support) — обычные участники его вообще не видят, каналы, за
        // которыми он следит, настраиваются отдельно командой /mod-queue add.
        const staffRoleIds = [
            securityConfig.baseRoleIds?.Admin,
            securityConfig.baseRoleIds?.Moderator,
            securityConfig.baseRoleIds?.['Beta-Moderator'],
            ticketsConfig.supportRoleId,
        ].filter(Boolean);

        const { channel, created } = await findOrCreateChannel({
            guild,
            existingId: config.reviewChannelId,
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    ...staffRoleIds.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel] })),
                ],
            },
        });
        console.log(
            created ? `Создан канал: ${CHANNEL_NAME}` : `Канал очереди модерации уже настроен: ${channel.name}`
        );

        await modqueue.updateConfig(cfg => {
            cfg.reviewChannelId = channel.id;
        });

        console.log(
            'Готово. Канал очереди модерации настроен. Включить проверку в конкретных каналах: /mod-queue add <канал>.'
        );
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки очереди модерации:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
