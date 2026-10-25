require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const modqueue = require('../modqueue');
const security = require('../security');
const tickets = require('../tickets');
const { findChannel } = require('../utils/idempotent');
const { isBootstrap } = require('../utils/setupMode');

const CHANNEL_NAME = '🛡️│очередь-модерации';

async function run(client) {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = await modqueue.getConfig();
        const securityConfig = await security.getConfig();
        const ticketsConfig = await tickets.getConfig();

        // Канал видят только модераторы (Admin/Moderator/Beta-Moderator/
        // Support) — обычные участники его вообще не видят, каналы, за
        // которыми он следит, настраиваются отдельно командой /mod-queue add.
        const staffRoleIds = [
            securityConfig.baseRoleIds?.Admin,
            securityConfig.baseRoleIds?.Moderator,
            securityConfig.baseRoleIds?.['Beta-Moderator'],
            ticketsConfig.supportRoleId,
        ].filter(Boolean);

        // По прямому запросу администратора — канал больше не создаётся
        // автоматически, только поиск по уже сохранённому ID/имени (см.
        // utils/idempotent.js findChannel).
        const channel = await findChannel({
            guild,
            existingId: config.reviewChannelId,
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
        });
        if (!channel) {
            console.warn(
                `Канал "${CHANNEL_NAME}" не найден — автосоздание отключено администратором. Создай канал вручную, конфиг подхватит его по имени на следующем деплое.`
            );
            return true;
        }
        console.log(`Канал очереди модерации уже настроен: ${channel.name}`);
        if (isBootstrap()) {
            await channel.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false }).catch(() => {});
            for (const id of staffRoleIds) {
                await channel.permissionOverwrites.edit(id, { ViewChannel: true }).catch(() => {});
            }
        }

        await modqueue.updateConfig(cfg => {
            cfg.reviewChannelId = channel.id;
        });

        console.log(
            'Готово. Канал очереди модерации настроен. Включить проверку в конкретных каналах: /mod-queue add <канал>.'
        );
        return true;
    } catch (err) {
        console.error('Ошибка настройки очереди модерации:', err);
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
