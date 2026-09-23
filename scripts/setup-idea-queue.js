require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const ideaQueue = require('../ideaQueue');
const security = require('../security');
const tickets = require('../tickets');
const { isBootstrap, ensureChannel } = require('../utils/setupMode');

// Канал, где участники пишут предложения по нему самому — задан
// администратором напрямую по ID (тот же приём, что MANAGEMENT_
// CATEGORY_ID у tickets/scripts/setup-ticket-management.js):
// используется только на первом запуске, чтобы записать его в
// config.channelId, дальше скрипт работает по уже сохранённому ID, а
// не по этой константе.
const IDEA_CHANNEL_ID = '1550216274544697424';

const REVIEW_CHANNEL_NAME = '📥│предложения-на-проверке';

// Максимум, который вообще принимает Discord для slowmode — участнику
// нужен перерыв между сообщениями, а не собственный кулдаун в БД: Discord
// сам не даст написать чаще одного раза в SLOWMODE_SECONDS, даже если
// сообщение сразу удаляется ботом на модерацию (слот считается занятым в
// момент отправки, не хранения). У модерации (право ManageMessages/
// ManageChannels) slowmode не действует — так это устроено в самом
// Discord, отдельно обходить не нужно.
const SLOWMODE_SECONDS = 6 * 60 * 60;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = await ideaQueue.getConfig();
        const securityConfig = await security.getConfig();
        const ticketsConfig = await tickets.getConfig();

        const channelId = config.channelId ?? IDEA_CHANNEL_ID;
        const channel =
            guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
        if (!channel) {
            console.error(`Канал ${channelId} не найден на сервере — очередь предложений не настроена.`);
            process.exit(1);
        }
        if (channel.type !== ChannelType.GuildText) {
            console.error(`${channelId} — не текстовый канал (тип ${channel.type}, "${channel.name}").`);
            process.exit(1);
        }

        // Только при первичной настройке — на каждом деплое это сбрасывало
        // slowmode, выставленный администратором вручную.
        if (isBootstrap()) {
            await channel
                .setRateLimitPerUser(SLOWMODE_SECONDS)
                .catch(err => console.error('Не удалось выставить slowmode на канал предложений:', err.message));
        }

        // Видят только модерация и поддержка — тот же набор ролей, что и у
        // канала очереди модерации (scripts/setup-modqueue.js).
        const staffRoleIds = [
            securityConfig.baseRoleIds?.Admin,
            securityConfig.baseRoleIds?.Moderator,
            securityConfig.baseRoleIds?.['Beta-Moderator'],
            ticketsConfig.supportRoleId,
            ticketsConfig.betaSupportRoleId,
        ].filter(Boolean);

        const { channel: reviewChannel, created } = await ensureChannel({
            guild,
            existingId: config.reviewChannelId,
            name: REVIEW_CHANNEL_NAME,
            type: ChannelType.GuildText,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    ...staffRoleIds.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel] })),
                ],
            },
        });
        if (created) {
            console.log(`Создан канал: ${REVIEW_CHANNEL_NAME}`);
        } else if (reviewChannel) {
            console.log('Канал проверки предложений уже настроен');
            if (isBootstrap()) {
                await reviewChannel.permissionOverwrites
                    .edit(guild.roles.everyone.id, { ViewChannel: false })
                    .catch(() => {});
                for (const id of staffRoleIds) {
                    await reviewChannel.permissionOverwrites.edit(id, { ViewChannel: true }).catch(() => {});
                }
            }
        }

        await ideaQueue.updateConfig(cfg => {
            cfg.channelId = channel.id;
            if (reviewChannel) cfg.reviewChannelId = reviewChannel.id;
        });

        console.log('Готово. Очередь предложений настроена.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки очереди предложений:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
