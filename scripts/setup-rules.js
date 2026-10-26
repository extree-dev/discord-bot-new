require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const rules = require('../rules');
const ideaQueue = require('../ideaQueue');
const { isBootstrap, ensureChannel, warnMissing } = require('../utils/setupMode');

const CATEGORY_NAME = '📋 Информация';
const CHANNEL_NAME = 'правила';

async function run(client) {
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
        if (!category) return true;
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
        if (!channel) return true;
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

        const ideaConfig = await ideaQueue.getConfig();
        // embeds: [] — старое сообщение было классическим embed'ом; без
        // явной очистки Discord отвергает PATCH, который одновременно
        // оставляет старый embed и включает флаг IS_COMPONENTS_V2 (тот же
        // приём, что при переводе tickets/suggestions/voice на V2, см.
        // scripts/setup-tickets.js).
        const payload = { ...rules.buildRulesMessage(ideaConfig.channelId), embeds: [] };

        let message = null;
        if (existingChannelId === channel.id && messageId) {
            message = await channel.messages.fetch(messageId).catch(() => null);
        }

        if (message) {
            await message.edit(payload);
            console.log('Существующее сообщение с правилами обновлено.');
        } else if (!isBootstrap()) {
            warnMissing('Сообщение с правилами не найдено');
        } else {
            message = await channel.send(payload);
            await message.pin().catch(err => console.error('Не удалось закрепить сообщение:', err.message));
            await rules.savePostedLocation(channel.id, message.id);
            console.log('Правила опубликованы и закреплены.');
        }

        console.log('Готово.');
        return true;
    } catch (err) {
        console.error('Ошибка настройки правил:', err);
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
