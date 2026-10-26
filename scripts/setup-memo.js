require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const memo = require('../memo');
const { isBootstrap, ensureChannel, warnMissing } = require('../utils/setupMode');

const CATEGORY_NAME = '📋 Информация';
const CHANNEL_NAME = 'памятка';

async function run(client) {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();

        const {
            channelId: existingChannelId,
            messageId,
            categoryId: existingCategoryId,
        } = await memo.getPostedLocation();

        const { channel: category, created: categoryCreated } = await ensureChannel({
            guild,
            existingId: existingCategoryId,
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
        });
        if (!category) return true;
        if (categoryCreated) console.log(`Создана категория: ${CATEGORY_NAME}`);
        if (existingCategoryId !== category.id) await memo.saveCategoryId(category.id);

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
        if (!channel) return true;
        if (created) {
            console.log(`Создан канал: ${CHANNEL_NAME}`);
        } else {
            console.log(`Канал памятки уже настроен: ${channel.name}`);
            if (isBootstrap()) {
                await channel.permissionOverwrites
                    .edit(guild.roles.everyone.id, { SendMessages: false })
                    .catch(err => console.error('Не удалось закрыть канал от записи:', err.message));
            }
        }

        const ids = await memo.gatherChannelIds(guild.id);
        // embeds: [] — на случай, если на канале уже было старое сообщение не
        // в Components V2 (тот же приём, что в scripts/setup-rules.js).
        const payload = { ...memo.buildMemoMessage(ids), embeds: [] };

        let message = null;
        if (existingChannelId === channel.id && messageId) {
            message = await channel.messages.fetch(messageId).catch(() => null);
        }

        if (message) {
            await message.edit(payload);
            console.log('Существующее сообщение с памяткой обновлено.');
        } else if (!isBootstrap()) {
            warnMissing('Сообщение с памяткой не найдено');
        } else {
            message = await channel.send(payload);
            await message.pin().catch(err => console.error('Не удалось закрепить сообщение:', err.message));
            await memo.savePostedLocation(channel.id, message.id);
            console.log('Памятка опубликована и закреплена.');
        }

        console.log('Готово.');
        return true;
    } catch (err) {
        console.error('Ошибка настройки памятки:', err);
        return false;
    }
}

module.exports = run;

if (require.main === module) {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    client.once('clientReady', async () => {
        const ok = await run(client);
        process.exit(ok ? 0 : 1);
    });
    client.login(process.env.DISCORD_TOKEN);
}
