require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, save } = require('../suggestions/config');
const security = require('../security');
const { buildPanelMessage } = require('../suggestions');
const { findOrCreateChannel } = require('./lib/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = await load();

        // канал с панелью — сюда пишет только бот, участники жмут кнопку
        const { channel: panelChannel, created: panelCreated } = await findOrCreateChannel({
            guild,
            existingId: config.panelChannelId,
            name: 'предложить-идею',
            type: ChannelType.GuildText,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            },
        });
        console.log(panelCreated ? 'Создан канал: предложить-идею' : 'Канал предложить-идею уже настроен');

        // канал вывода предложений — тоже read-only для участников, туда публикует бот
        const { channel: outputChannel, created: outputCreated } = await findOrCreateChannel({
            guild,
            existingId: config.outputChannelId,
            name: 'предложения',
            type: ChannelType.GuildText,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            },
        });
        console.log(outputCreated ? 'Создан канал: предложения' : 'Канал предложения уже настроен');

        const securityConfig = await security.getConfig();
        if (securityConfig.verification.unverifiedRoleId) {
            const unverifiedRole = guild.roles.cache.get(securityConfig.verification.unverifiedRoleId);
            if (unverifiedRole) {
                await panelChannel.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
                await outputChannel.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
                console.log(`Каналы закрыты от роли ${unverifiedRole.name}`);
            }
        }

        const messages = await panelChannel.messages.fetch({ limit: 10 });
        const existingPanel = messages.find(m => m.author.id === client.user.id && m.components.length > 0);
        if (existingPanel) {
            // embeds: [] — та же причина, что и у панели тикетов/голосовых
            // комнат: без явной очистки Discord отвергает PATCH, который
            // одновременно оставляет старый embed и включает флаг
            // IS_COMPONENTS_V2.
            await existingPanel.edit({ ...buildPanelMessage(), embeds: [] });
            console.log('Панель предложений обновлена.');
        } else {
            await panelChannel.send(buildPanelMessage());
            console.log('Панель предложений отправлена.');
        }

        await save({ ...config, panelChannelId: panelChannel.id, outputChannelId: outputChannel.id });

        console.log('Готово. Система предложений настроена.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки предложений:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
