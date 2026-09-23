require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const rules = require('../rules');
const { isBootstrap, ensureChannel, warnMissing } = require('../utils/setupMode');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CATEGORY_NAME = '📋 Информация';
const CHANNEL_NAME = 'правила';

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();

        const {
            channelId: existingChannelId,
            messageId,
            categoryId: existingCategoryId,
        } = await rules.getPostedLocation();

        const { channel: category, created: categoryCreated } = await ensureChannel({
            guild,
            existingId: existingCategoryId,
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
        });
        if (!category) process.exit(0);
        if (categoryCreated) console.log(`Создана категория: ${CATEGORY_NAME}`);
        if (existingCategoryId !== category.id) await rules.saveCategoryId(category.id);

        const { channel, created } = await ensureChannel({
            guild,
            existingId: existingChannelId,
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            },
        });
        if (!channel) process.exit(0);
        if (created) {
            console.log(`Создан канал: ${CHANNEL_NAME}`);
        } else {
            console.log(`Канал правил уже настроен: ${channel.name}`);
            // Правила должны быть read-only для всех, кроме модерации —
            // выставляем только при первичной настройке, не на каждом деплое.
            if (isBootstrap()) {
                await channel.permissionOverwrites
                    .edit(guild.roles.everyone.id, { SendMessages: false })
                    .catch(err => console.error('Не удалось закрыть канал от записи:', err.message));
            }
        }

        const embed = rules.buildRulesEmbed();

        let message = null;
        if (existingChannelId === channel.id && messageId) {
            message = await channel.messages.fetch(messageId).catch(() => null);
        }

        if (message) {
            await message.edit({ embeds: [embed] });
            console.log('Существующее сообщение с правилами обновлено.');
        } else if (!isBootstrap()) {
            warnMissing('Сообщение с правилами не найдено');
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
