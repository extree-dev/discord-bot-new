require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const changelog = require('../changelog');
const { findOrCreateChannel } = require('./lib/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CATEGORY_NAME = '📋 Информация';
const CHANNEL_NAME = 'обновления';

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();

        const existing = await changelog.getConfig();

        // Та же категория, что и у #правила — обе про "справочную"
        // информацию о сервере/боте, не про общение.
        let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME);
        if (!category) {
            category = await guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory });
            console.log(`Создана категория: ${CATEGORY_NAME}`);
        }

        const { channel, created } = await findOrCreateChannel({
            guild,
            existingId: existing.channelId,
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            },
        });
        if (created) {
            console.log(`Создан канал: ${CHANNEL_NAME}`);
        } else {
            console.log(`Канал обновлений уже настроен: ${channel.name}`);
            await channel.permissionOverwrites
                .edit(guild.roles.everyone.id, { SendMessages: false })
                .catch(err => console.error('Не удалось закрыть канал от записи:', err.message));
        }

        if (existing.channelId !== channel.id) {
            await changelog.saveChannel(channel.id);
            console.log('Канал обновлений сохранён в конфиге.');
        }

        console.log('Готово. Анонс новой версии публикуется автоматически при первом запуске бота на ней.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки канала обновлений:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
