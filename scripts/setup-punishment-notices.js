require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const security = require('../security');
const { findChannel } = require('../utils/idempotent');
const { isBootstrap } = require('../utils/setupMode');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = await security.getConfig();

        // Канал — только родитель для приватных тредов-уведомлений
        // (utils/punishmentNotice.js), сам по себе никому кроме бота не
        // нужен: скрыт от @everyone. Членство в конкретном треде даёт
        // доступ к нему независимо от видимости родительского канала —
        // так же, как уже работают треды тикетов под скрытыми категориями.
        // По прямому запросу администратора — канал больше не создаётся
        // автоматически, только поиск по уже сохранённому ID/имени (см.
        // utils/idempotent.js findChannel).
        const channel = await findChannel({
            guild,
            existingId: config.punishmentNoticeChannelId,
            name: 'уведомления-о-наказаниях',
            type: ChannelType.GuildText,
        });
        if (!channel) {
            console.warn(
                'Канал "уведомления-о-наказаниях" не найден — автосоздание отключено администратором. Создай канал вручную, конфиг подхватит его по имени на следующем деплое.'
            );
            process.exit(0);
        }
        console.log('Канал уведомления-о-наказаниях уже настроен');
        if (isBootstrap()) {
            await channel.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false }).catch(() => {});
        }

        await security.updateConfig(cfg => {
            cfg.punishmentNoticeChannelId = channel.id;
        });

        console.log('Готово. Уведомления о наказаниях настроены.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки уведомлений о наказаниях:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
