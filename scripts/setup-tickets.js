require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, save } = require('../tickets/config');
const security = require('../security');
const { buildPanelMessage } = require('../tickets');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Роли-специалисты по темам тикетов — не каждый модератор из общего
// Support понимает, например, донат-платежи или апелляции наказаний,
// поэтому createTicket() дополнительно пингует нужную роль под темой
// (tickets/model.js REASONS + config.reasonRoleIds). Видимость треда
// даёт то же ManageThreads на панельном канале, что и у supportRole —
// тот же trade-off, что и для supportRole: роль видит вообще все
// тикеты, не только свою тему, но зато точно не пропустит пинг.
// Цвет у каждой роли свой — по смыслу темы (баги/жалобы/деньги/суд/защита).
const SPECIALIST_ROLES = {
    bug: { name: '🐞 Спец. по багам', color: 0xe67e22 },
    report: { name: '🚩 Спец. по жалобам', color: 0xe74c3c },
    payment: { name: '💳 Спец. по донату', color: 0xf1c40f },
    appeal: { name: '⚖️ Спец. по апелляциям', color: 0x9b59b6 },
    security: { name: '🛡️ Спец. по безопасности', color: 0x1abc9c },
};

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = await load();

        // роль поддержки
        let supportRole = config.supportRoleId ? guild.roles.cache.get(config.supportRoleId) : null;
        if (!supportRole) {
            supportRole = guild.roles.cache.find(r => r.name === 'Support');
        }
        if (!supportRole) {
            supportRole = await guild.roles.create({
                name: 'Support',
                color: 0x2ecc71,
                hoist: true,
                mentionable: false,
                permissions: [],
            });
            console.log('Создана роль: Support');

            const moderatorRole = guild.roles.cache.find(r => r.name === 'Moderator');
            if (moderatorRole) {
                await supportRole.setPosition(moderatorRole.position - 1).catch(() => {});
            }
        } else {
            console.log('Роль Support уже существует');
        }

        // роли-специалисты по темам тикетов
        const reasonRoleIds = { ...config.reasonRoleIds };
        const specialistRoles = [];
        for (const [reasonValue, spec] of Object.entries(SPECIALIST_ROLES)) {
            let role = reasonRoleIds[reasonValue] ? guild.roles.cache.get(reasonRoleIds[reasonValue]) : null;
            if (!role) role = guild.roles.cache.find(r => r.name === spec.name);
            if (!role) {
                role = await guild.roles.create({
                    name: spec.name,
                    color: spec.color,
                    hoist: true,
                    mentionable: false,
                    permissions: [],
                });
                console.log(`Создана роль: ${spec.name}`);
            } else if (role.name !== spec.name || role.hexColor !== `#${spec.color.toString(16).padStart(6, '0')}`) {
                await role.edit({ name: spec.name, color: spec.color }).catch(() => {});
                console.log(`Роль обновлена: ${spec.name}`);
            } else {
                console.log(`Роль ${spec.name} уже существует`);
            }
            reasonRoleIds[reasonValue] = role.id;
            specialistRoles.push(role);
        }

        // По умолчанию Discord создаёт новую роль в самом низу иерархии
        // (сразу над @everyone) — поднимаем роли-специалистов на уровень
        // Support, чтобы они были на виду, а не терялись внизу списка.
        await guild.roles
            .setPositions(specialistRoles.map(role => ({ role, position: supportRole.position })))
            .catch(err => console.error('Не удалось поднять роли-специалистов в иерархии:', err.message));

        // категория тикетов
        let category = config.categoryId ? guild.channels.cache.get(config.categoryId) : null;
        if (!category)
            category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'Поддержка');
        if (!category) {
            category = await guild.channels.create({ name: 'Поддержка', type: ChannelType.GuildCategory });
            console.log('Создана категория: Поддержка');
        } else {
            console.log('Категория Поддержка уже существует');
        }

        const securityConfig = await security.getConfig();
        if (securityConfig.verification.unverifiedRoleId) {
            const unverifiedRole = guild.roles.cache.get(securityConfig.verification.unverifiedRoleId);
            if (unverifiedRole) {
                await category.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
                console.log(`Категория закрыта от роли ${unverifiedRole.name}`);
            }
        }

        // Панель открытия тикета — этот же канал теперь родитель для
        // приватных тредов-тикетов (createTicket создаёт тред прямо в
        // нём). supportRole получает ManageThreads, чтобы видеть и
        // открывать любой приватный тред канала без ручного добавления
        // в каждый — иначе пришлось бы add()'ить каждого сотрудника в
        // каждый новый тикет по отдельности.
        let panelChannel = config.panelChannelId ? guild.channels.cache.get(config.panelChannelId) : null;
        if (!panelChannel)
            panelChannel = guild.channels.cache.find(c => c.parentId === category.id && c.name === 'открыть-тикет');
        if (!panelChannel) {
            panelChannel = await guild.channels.create({
                name: 'открыть-тикет',
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
                    {
                        id: supportRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageThreads],
                    },
                ],
            });
            console.log('Создан канал: открыть-тикет');
        } else {
            console.log('Канал открыть-тикет уже существует');
            await panelChannel.permissionOverwrites
                .edit(supportRole.id, { ViewChannel: true, ManageThreads: true })
                .catch(() => {});
        }

        // Специалисты по темам получают тот же доступ, что и supportRole —
        // без ManageThreads на этом канале роль не увидит приватный тред,
        // в который её только пингнули.
        for (const roleId of Object.values(reasonRoleIds)) {
            await panelChannel.permissionOverwrites
                .edit(roleId, { ViewChannel: true, ManageThreads: true })
                .catch(() => {});
        }

        const messages = await panelChannel.messages.fetch({ limit: 10 });
        const existingPanel = messages.find(m => m.author.id === client.user.id && m.components.length > 0);
        if (existingPanel) {
            await existingPanel.edit(buildPanelMessage(guild));
            console.log('Панель тикетов обновлена.');
        } else {
            await panelChannel.send(buildPanelMessage(guild));
            console.log('Панель тикетов отправлена.');
        }

        // лог-канал для транскриптов, в уже существующей стафф-категории 🔐 Модерация
        let logChannel = config.logChannelId ? guild.channels.cache.get(config.logChannelId) : null;
        if (!logChannel) {
            const staffCategory = guild.channels.cache.find(
                c => c.type === ChannelType.GuildCategory && c.name === '🔐 Модерация'
            );
            logChannel = guild.channels.cache.find(c => c.name === 'ticket-log');
            if (!logChannel) {
                logChannel = await guild.channels.create({
                    name: 'ticket-log',
                    type: ChannelType.GuildText,
                    parent: staffCategory?.id ?? null,
                    permissionOverwrites: [
                        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        {
                            id: supportRole.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                        },
                    ],
                });
                console.log('Создан канал: ticket-log');
            } else {
                console.log('Канал ticket-log уже существует');
            }
        }

        config.categoryId = category.id;
        config.panelChannelId = panelChannel.id;
        config.logChannelId = logChannel.id;
        config.supportRoleId = supportRole.id;
        config.reasonRoleIds = reasonRoleIds;
        await save(config);

        console.log('Готово. Система тикетов настроена.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки тикетов:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
