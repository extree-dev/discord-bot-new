require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const rules = require('../rules');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CATEGORY_NAME = '📋 Информация';
const CHANNEL_NAME = 'правила';

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();

        let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME);
        if (!category) {
            category = await guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory });
            console.log(`Создана категория: ${CATEGORY_NAME}`);
        }

        let channel = guild.channels.cache.find(c => c.parentId === category.id && c.name === CHANNEL_NAME);
        if (!channel) {
            channel = await guild.channels.create({
                name: CHANNEL_NAME,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            });
            console.log(`Создан канал: ${CHANNEL_NAME}`);
        } else {
            // Канал мог существовать до этого скрипта (например, из
            // setup-server.js) без ограничения на отправку сообщений —
            // правила должны быть read-only для всех, кроме модерации.
            await channel.permissionOverwrites
                .edit(guild.roles.everyone.id, { SendMessages: false })
                .catch(err => console.error('Не удалось закрыть канал от записи:', err.message));
        }

        const embed = rules.buildRulesEmbed();
        const { channelId, messageId } = await rules.getPostedLocation();

        let message = null;
        if (channelId === channel.id && messageId) {
            message = await channel.messages.fetch(messageId).catch(() => null);
        }

        if (message) {
            await message.edit({ embeds: [embed] });
            console.log('Существующее сообщение с правилами обновлено.');
        } else {
            message = await channel.send({ embeds: [embed] });
            await message.pin().catch(err => console.error('Не удалось закрепить сообщение:', err.message));
            await rules.savePostedLocation(channel.id, message.id);
            console.log('Правила опубликованы и закреплены.');
        }

        console.log('Готово.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки правил:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
