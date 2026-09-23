require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, update } = require('../suggestions/config');
const security = require('../security');
const { buildPanelMessage } = require('../suggestions');
const { findChannel } = require('../utils/idempotent');
const { isBootstrap, ensureChannel, refreshPanel } = require('../utils/setupMode');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = await load();

        // По прямому запросу администратора — канал больше не создаётся
        // автоматически (только поиск по уже сохранённому ID/имени), чтобы
        // случайное расхождение с сервером (удалённый канал, потерянный ID)
        // не плодило рядом дубликат: раньше это уже приводило к путанице
        // при деплое. Если канал не найден — панель просто не обновляется
        // в этом запуске, остальная настройка (канал вывода ниже) не страдает.
        const panelChannel = await findChannel({
            guild,
            existingId: config.panelChannelId,
            name: 'предложить-идею',
            type: ChannelType.GuildText,
        });
        if (!panelChannel) {
            console.warn(
                'Канал "предложить-идею" не найден — автосоздание отключено администратором. Создай канал вручную (или верни прежний), панель обновится на следующем деплое.'
            );
        }

        // канал вывода предложений — тоже read-only для участников, туда публикует бот
        const { channel: outputChannel, created: outputCreated } = await ensureChannel({
            guild,
            existingId: config.outputChannelId,
            name: 'предложения',
            type: ChannelType.GuildText,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            },
        });
        if (outputChannel) {
            console.log(outputCreated ? 'Создан канал: предложения' : 'Канал предложения уже настроен');
        }

        if (isBootstrap()) {
            const securityConfig = await security.getConfig();
            const unverifiedRole = securityConfig.verification.unverifiedRoleId
                ? guild.roles.cache.get(securityConfig.verification.unverifiedRoleId)
                : null;
            if (unverifiedRole) {
                for (const ch of [panelChannel, outputChannel].filter(Boolean)) {
                    await ch.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
                }
                console.log(`Каналы закрыты от роли ${unverifiedRole.name}`);
            }
        }

        if (panelChannel) {
            // embeds: [] — без явной очистки Discord отвергает PATCH, который
            // одновременно оставляет старый embed и включает флаг
            // IS_COMPONENTS_V2.
            await refreshPanel({
                channel: panelChannel,
                botId: client.user.id,
                payload: { ...buildPanelMessage(), embeds: [] },
                label: 'Предложения',
            });
        }

        // Точечно через update(): в том же сторе счётчик предложений, который
        // бот может увеличить прямо во время деплоя.
        await update(cfg => {
            if (panelChannel) cfg.panelChannelId = panelChannel.id;
            if (outputChannel) cfg.outputChannelId = outputChannel.id;
        });

        console.log('Готово. Система предложений настроена.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки предложений:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
