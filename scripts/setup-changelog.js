require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const changelog = require('../changelog');
const { findChannel, findOrCreateChannel } = require('../utils/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CATEGORY_NAME = '📋 Информация';
const CHANNEL_NAME = 'обновления';

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();

        const existing = await changelog.getConfig();

        // Та же категория, что и у #правила — обе про "справочную"
        // информацию о сервере/боте, не про общение. Свой categoryId в
        // конфиге changelog/ (не общий с rules/) — у каждой фичи
        // независимый config-store (см. FSD-границы в README).
        const { channel: category, created: categoryCreated } = await findOrCreateChannel({
            guild,
            existingId: existing.categoryId,
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
        });
        if (categoryCreated) console.log(`Создана категория: ${CATEGORY_NAME}`);

        // По прямому запросу администратора — канал больше не создаётся
        // автоматически, только поиск по уже сохранённому ID/имени (см.
        // utils/idempotent.js findChannel).
        const channel = await findChannel({
            guild,
            existingId: existing.channelId,
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            parentId: category.id,
        });
        if (channel) {
            console.log(`Канал обновлений уже настроен: ${channel.name}`);
            await channel.permissionOverwrites
                .edit(guild.roles.everyone.id, { SendMessages: false })
                .catch(err => console.error('Не удалось закрыть канал от записи:', err.message));
        } else {
            console.warn(
                `Канал "${CHANNEL_NAME}" не найден — автосоздание отключено администратором. Создай канал вручную, конфиг подхватит его по имени на следующем деплое.`
            );
        }

        if (channel && (existing.channelId !== channel.id || existing.categoryId !== category.id)) {
            await changelog.saveChannel(channel.id, category.id);
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
