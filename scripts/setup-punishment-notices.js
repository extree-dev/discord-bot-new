require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const security = require('../security');
const { findOrCreateChannel } = require('../utils/idempotent');

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
        const { channel, created } = await findOrCreateChannel({
            guild,
            existingId: config.punishmentNoticeChannelId,
            name: 'уведомления-о-наказаниях',
            type: ChannelType.GuildText,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }],
            },
        });
        console.log(created ? 'Создан канал: уведомления-о-наказаниях' : 'Канал уведомления-о-наказаниях уже настроен');

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
