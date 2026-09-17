require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, save } = require('../suggestions/config');
const security = require('../security');
const { buildPanelMessage } = require('../suggestions');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = await load();

        // канал с панелью — сюда пишет только бот, участники жмут кнопку
        let panelChannel = config.panelChannelId ? guild.channels.cache.get(config.panelChannelId) : null;
        if (!panelChannel) panelChannel = guild.channels.cache.find(c => c.name === 'предложить-идею');
        if (!panelChannel) {
            panelChannel = await guild.channels.create({
                name: 'предложить-идею',
                type: ChannelType.GuildText,
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            });
            console.log('Создан канал: предложить-идею');
        } else {
            console.log('Канал предложить-идею уже существует');
        }

        // канал вывода предложений — тоже read-only для участников, туда публикует бот
        let outputChannel = config.outputChannelId ? guild.channels.cache.get(config.outputChannelId) : null;
        if (!outputChannel) outputChannel = guild.channels.cache.find(c => c.name === 'предложения');
        if (!outputChannel) {
            outputChannel = await guild.channels.create({
                name: 'предложения',
                type: ChannelType.GuildText,
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            });
            console.log('Создан канал: предложения');
        } else {
            console.log('Канал предложения уже существует');
        }

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
            await existingPanel.edit(buildPanelMessage());
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
