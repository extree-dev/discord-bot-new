require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, update } = require('../tickets/config');
const security = require('../security');
const { buildManagementPanelMessage } = require('../tickets');
const { isBootstrap, ensureChannel, refreshPanel } = require('../utils/setupMode');

// Панель управления тикетами — по прямому запросу администратора:
// staff-only канал с сообщением-панелью (кнопки "Активные тикеты" /
// "Статистика", см. tickets/handlers.js). Категория задана администратором
// напрямую по ID (не по имени, как у остальных setup-*.js) — MANAGEMENT_
// CATEGORY_ID используется только на самом первом запуске, чтобы записать
// его в config.managementCategoryId; дальше (как и everywhere в проекте,
// см. utils/idempotent.js) скрипт работает по уже сохранённому ID, а не
// по этой константе, так что переезд панели в другую категорию вручную
// администратором не будет каждый раз откатываться назад.
const MANAGEMENT_CATEGORY_ID = '1551543086671335494';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = await load();
        const securityConfig = await security.getConfig();
        const moderatorRole = guild.roles.cache.find(r => r.name === 'Moderator');
        const betaModeratorRoleId = securityConfig.baseRoleIds?.['Beta-Moderator'] ?? null;
        const betaModeratorRole = betaModeratorRoleId ? guild.roles.cache.get(betaModeratorRoleId) : null;
        const supportRole = config.supportRoleId ? guild.roles.cache.get(config.supportRoleId) : null;
        const betaSupportRole = config.betaSupportRoleId ? guild.roles.cache.get(config.betaSupportRoleId) : null;

        const categoryId = config.managementCategoryId ?? MANAGEMENT_CATEGORY_ID;
        const category =
            guild.channels.cache.get(categoryId) ?? (await guild.channels.fetch(categoryId).catch(() => null));
        if (!category) {
            console.error(`Категория ${categoryId} не найдена на сервере — панель управления не настроена.`);
            process.exit(1);
        }
        if (category.type !== ChannelType.GuildCategory) {
            console.error(
                `${categoryId} — не категория (тип ${category.type}, "${category.name}"). ` +
                    'Скопируй ID именно категории (правой кнопкой по заголовку категории → Копировать ID), не канала внутри неё.'
            );
            process.exit(1);
        }

        // Видят только staff — тот же список ролей и та же логика явного
        // оверрайта на самого бота, что submissionsChannel в setup-tickets.js.
        const staffRoles = [supportRole, betaSupportRole, moderatorRole, betaModeratorRole].filter(Boolean);
        const overwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel] },
            ...staffRoles.map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel] })),
        ];
        const { channel, created } = await ensureChannel({
            guild,
            existingId: config.managementChannelId,
            name: '🛠️│управление-тикетами',
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: { permissionOverwrites: overwrites },
        });
        if (!channel) process.exit(0);
        console.log(created ? 'Создан канал: 🛠️│управление-тикетами' : 'Канал управления тикетами уже настроен');

        if (isBootstrap() && !created) {
            await channel.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false }).catch(() => {});
            await channel.permissionOverwrites.edit(client.user.id, { ViewChannel: true }).catch(() => {});
            for (const role of staffRoles) {
                await channel.permissionOverwrites.edit(role.id, { ViewChannel: true }).catch(() => {});
            }
        }

        await refreshPanel({
            channel,
            botId: client.user.id,
            payload: { ...buildManagementPanelMessage(), embeds: [] },
            label: 'Управление тикетами',
        });

        // Точечно через update(): в том же сторе живые тикеты, которые бот
        // может менять прямо во время деплоя.
        await update(cfg => {
            cfg.managementCategoryId = category.id;
            cfg.managementChannelId = channel.id;
        });

        console.log('Готово. Панель управления тикетами настроена.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки панели управления тикетами:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
