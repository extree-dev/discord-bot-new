require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, save } = require('../tickets/config');
const security = require('../security');
const { buildPanelMessage } = require('../tickets');
const { findOrCreateChannel, findOrCreateRole } = require('../utils/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Роли-специалисты по темам тикетов — не каждый модератор из общего
// Support понимает, например, апелляции наказаний, поэтому createTicket()
// дополнительно пингует нужную роль под темой (tickets/model.js REASONS +
// config.reasonRoleIds). Видимость треда даёт то же ManageThreads на
// панельном канале, что и у supportRole — тот же trade-off, что и для
// supportRole: роль видит вообще все тикеты, не только свою тему, но
// зато точно не пропустит пинг. Баг в самом боте — не вопрос модерации,
// а вопрос того, кто его написал, поэтому у темы "bug" не роль поддержки,
// а роль разработчика. Цвет у каждой роли свой — по смыслу темы.
const SPECIALIST_ROLES = {
    bug: { name: 'Разработчик бота', color: 0xe67e22 },
    report: { name: 'Reports', color: 0xe74c3c },
    appeal: { name: 'Appeals', color: 0x9b59b6 },
};

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const config = await load();

        // роль поддержки
        const { role: supportRole, created: supportCreated } = await findOrCreateRole({
            guild,
            existingId: config.supportRoleId,
            name: 'Support',
            color: 0x2ecc71,
            hoist: true,
            mentionable: false,
            permissions: [],
        });
        if (supportCreated) {
            console.log('Создана роль: Support');
            const moderatorRole = guild.roles.cache.find(r => r.name === 'Moderator');
            if (moderatorRole) {
                await supportRole.setPosition(moderatorRole.position - 1).catch(() => {});
            }
        } else {
            console.log(`Роль Support уже настроена: ${supportRole.name}`);
        }

        // роли-специалисты по темам тикетов — убранные темы ("payment",
        // "security") просто перестают отслеживаться и получать пинги;
        // сами роли на сервере скрипт не трогает и не удаляет, это на
        // усмотрение администратора.
        const reasonRoleIds = {};
        for (const reasonValue of Object.keys(SPECIALIST_ROLES)) {
            if (config.reasonRoleIds[reasonValue]) reasonRoleIds[reasonValue] = config.reasonRoleIds[reasonValue];
        }
        const specialistRoles = [];
        for (const [reasonValue, spec] of Object.entries(SPECIALIST_ROLES)) {
            // existingId найден — используем как есть, не переименовываем и не
            // перекрашиваем: администратор мог осознанно изменить имя/цвет
            // после создания, и это не повод откатывать их на дефолт при
            // каждом деплое.
            const { role, created } = await findOrCreateRole({
                guild,
                existingId: reasonRoleIds[reasonValue],
                name: spec.name,
                color: spec.color,
                hoist: true,
                mentionable: false,
                permissions: [],
            });
            console.log(created ? `Создана роль: ${spec.name}` : `Роль уже настроена: ${role.name}`);
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
        const { channel: category, created: categoryCreated } = await findOrCreateChannel({
            guild,
            existingId: config.categoryId,
            name: 'Поддержка',
            type: ChannelType.GuildCategory,
        });
        console.log(categoryCreated ? 'Создана категория: Поддержка' : 'Категория Поддержка уже настроена');

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
        const { channel: panelChannel, created: panelChannelCreated } = await findOrCreateChannel({
            guild,
            existingId: config.panelChannelId,
            name: 'открыть-тикет',
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
                    {
                        id: supportRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageThreads],
                    },
                ],
            },
        });
        if (panelChannelCreated) {
            console.log('Создан канал: открыть-тикет');
        } else {
            console.log('Канал открыть-тикет уже настроен');
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
            // embeds: [] — старая панель (до перехода на Components V2)
            // была embed'ом; без явной очистки Discord отвергает PATCH,
            // который одновременно оставляет старый embed и включает флаг
            // IS_COMPONENTS_V2 (см. падение деплоя на этом самом вызове).
            await existingPanel.edit({ ...buildPanelMessage(), embeds: [] });
            console.log('Панель тикетов обновлена.');
        } else {
            await panelChannel.send(buildPanelMessage());
            console.log('Панель тикетов отправлена.');
        }

        // лог-канал для транскриптов, в уже существующей стафф-категории 🔐 Модерация
        const staffCategory = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name === '🔐 Модерация'
        );
        const { channel: logChannel, created: logChannelCreated } = await findOrCreateChannel({
            guild,
            existingId: config.logChannelId,
            name: 'ticket-log',
            type: ChannelType.GuildText,
            parentId: staffCategory?.id,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    {
                        id: supportRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                    },
                ],
            },
        });
        console.log(logChannelCreated ? 'Создан канал: ticket-log' : 'Канал ticket-log уже настроен');

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
