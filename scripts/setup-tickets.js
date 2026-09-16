require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, save } = require('../tickets/config');
const { load: loadSecurity } = require('../security/config');
const { buildPanelMessage } = require('../tickets/tickets');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = load();

        // роль поддержки
        let supportRole = config.supportRoleId ? guild.roles.cache.get(config.supportRoleId) : null;
        if (!supportRole) {
            supportRole = guild.roles.cache.find(r => r.name === 'Support');
        }
        if (!supportRole) {
            supportRole = await guild.roles.create({
                name: 'Support',
                color: 0x2ecc71,
                hoist: true,
                mentionable: false,
                permissions: [],
            });
            console.log('Создана роль: Support');

            const moderatorRole = guild.roles.cache.find(r => r.name === 'Moderator');
            if (moderatorRole) {
                await supportRole.setPosition(moderatorRole.position - 1).catch(() => {});
            }
        } else {
            console.log('Роль Support уже существует');
        }

        // категория тикетов
        let category = config.categoryId ? guild.channels.cache.get(config.categoryId) : null;
        if (!category) category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'Поддержка');
        if (!category) {
            category = await guild.channels.create({ name: 'Поддержка', type: ChannelType.GuildCategory });
            console.log('Создана категория: Поддержка');
        } else {
            console.log('Категория Поддержка уже существует');
        }

        const security = loadSecurity();
        if (security.verification.unverifiedRoleId) {
            const unverifiedRole = guild.roles.cache.get(security.verification.unverifiedRoleId);
            if (unverifiedRole) {
                await category.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
                console.log(`Категория закрыта от роли ${unverifiedRole.name}`);
            }
        }

        // панель открытия тикета
        let panelChannel = config.panelChannelId ? guild.channels.cache.get(config.panelChannelId) : null;
        if (!panelChannel) panelChannel = guild.channels.cache.find(c => c.parentId === category.id && c.name === 'открыть-тикет');
        if (!panelChannel) {
            panelChannel = await guild.channels.create({
                name: 'открыть-тикет',
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            });
            console.log('Создан канал: открыть-тикет');
        } else {
            console.log('Канал открыть-тикет уже существует');
        }

        const messages = await panelChannel.messages.fetch({ limit: 10 });
        const existingPanel = messages.find(m => m.author.id === client.user.id && m.components.length > 0);
        if (existingPanel) {
            await existingPanel.edit(buildPanelMessage(guild));
            console.log('Панель тикетов обновлена.');
        } else {
            await panelChannel.send(buildPanelMessage(guild));
            console.log('Панель тикетов отправлена.');
        }

        // лог-канал для транскриптов, в уже существующей стафф-категории 🔐 Модерация
        let logChannel = config.logChannelId ? guild.channels.cache.get(config.logChannelId) : null;
        if (!logChannel) {
            const staffCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '🔐 Модерация');
            logChannel = guild.channels.cache.find(c => c.name === 'ticket-log');
            if (!logChannel) {
                logChannel = await guild.channels.create({
                    name: 'ticket-log',
                    type: ChannelType.GuildText,
                    parent: staffCategory?.id ?? null,
                    permissionOverwrites: [
                        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
                    ],
                });
                console.log('Создан канал: ticket-log');
            } else {
                console.log('Канал ticket-log уже существует');
            }
        }

        config.categoryId = category.id;
        config.panelChannelId = panelChannel.id;
        config.logChannelId = logChannel.id;
        config.supportRoleId = supportRole.id;
        save(config);

        console.log('Готово. Система тикетов настроена.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки тикетов:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
