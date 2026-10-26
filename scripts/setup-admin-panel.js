require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const adminPanel = require('../adminPanel');
const security = require('../security');
const { isBootstrap, ensureChannel, refreshPanel } = require('../utils/setupMode');

const CATEGORY_NAME = '🔐 Модерация';
const CHANNEL_NAME = '🎛️│панель-администратора';

async function run(client) {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = await adminPanel.getConfig();
        const securityConfig = await security.getConfig();

        // Действия на панели (lockdown, модули безопасности, бэкап) по
        // чувствительности эквивалентны /lockdown, /backup, /security-status —
        // все они уже требуют Administrator, а не просто ModerateMembers,
        // поэтому канал видит только роль Admin, не вся модерация.
        const adminRoleId = securityConfig.baseRoleIds?.Admin;
        if (!adminRoleId || !guild.roles.cache.has(adminRoleId)) {
            console.error(
                'Роль Admin не найдена в security-config (baseRoleIds.Admin) — прогони scripts/setup-roles.js раньше этого скрипта.'
            );
            return false;
        }

        // Та же категория, что и security-log (security/logger.js) — поиск
        // по имени находит уже существующую, дубликата не будет.
        const { channel: category } = await ensureChannel({
            guild,
            existingId: config.categoryId,
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }],
            },
        });
        if (!category) return true;

        const overwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel] },
            { id: adminRoleId, allow: [PermissionFlagsBits.ViewChannel] },
        ];
        const { channel, created } = await ensureChannel({
            guild,
            existingId: config.channelId,
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: { permissionOverwrites: overwrites },
        });
        if (!channel) return true;
        if (created) {
            console.log(`Создан канал: ${CHANNEL_NAME}`);
        } else {
            console.log('Канал панели администратора уже настроен');
            if (isBootstrap()) {
                await channel.permissionOverwrites
                    .edit(guild.roles.everyone.id, { ViewChannel: false })
                    .catch(() => {});
                await channel.permissionOverwrites.edit(client.user.id, { ViewChannel: true }).catch(() => {});
                await channel.permissionOverwrites.edit(adminRoleId, { ViewChannel: true }).catch(() => {});
            }
        }

        const status = await adminPanel.gatherStatus();
        await refreshPanel({
            channel,
            botId: client.user.id,
            payload: adminPanel.buildPanelMessage(status),
            label: 'Панель администратора',
        });

        await adminPanel.updateConfig(cfg => {
            cfg.channelId = channel.id;
            cfg.categoryId = category.id;
        });

        console.log('Готово. Панель администратора настроена.');
        return true;
    } catch (err) {
        console.error('Ошибка настройки панели администратора:', err);
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
