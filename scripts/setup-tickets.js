require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, save } = require('../tickets/config');
const security = require('../security');
const { buildPanelMessage, buildBugPanelMessage } = require('../tickets');
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
        const securityConfig = await security.getConfig();
        const moderatorRole = guild.roles.cache.find(r => r.name === 'Moderator');
        const betaModeratorRoleId =
            securityConfig.baseRoleIds?.['Beta-Moderator'] ?? config.betaModeratorRoleId ?? null;
        const betaModeratorRole = betaModeratorRoleId ? guild.roles.cache.get(betaModeratorRoleId) : null;

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
            if (moderatorRole) {
                await supportRole.setPosition(moderatorRole.position - 1).catch(() => {});
            }
        } else {
            console.log(`Роль Support уже настроена: ${supportRole.name}`);
        }

        // Испытательный срок для саппорта — как и Beta-Moderator (см.
        // setup-roles.js), без опасных Discord-прав (Support их тоже не
        // держит — доступ к тикетам даёт не permission, а членство в
        // роли), но closeTicket() для стажёра уходит на подтверждение
        // старшему составу (tickets/model.js isTrialStaff/requestTicketClosure).
        const { role: betaSupportRole, created: betaSupportCreated } = await findOrCreateRole({
            guild,
            existingId: config.betaSupportRoleId,
            name: 'Beta-Support',
            color: 0x58d68d,
            hoist: true,
            mentionable: false,
            permissions: [],
        });
        if (betaSupportCreated) {
            console.log('Создана роль: Beta-Support');
            await betaSupportRole.setPosition(supportRole.position - 1).catch(() => {});
        } else {
            console.log(`Роль Beta-Support уже настроена: ${betaSupportRole.name}`);
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
        // Роль-владелец отдельной системы багов (standalone-тема, см.
        // tickets/model.js REASONS) — захватываем из того же цикла, что
        // создаёт все роли-специалисты, вместо отдельного findOrCreateRole.
        let developerRole = null;
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
            if (reasonValue === 'bug') developerRole = role;
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

        if (securityConfig.verification.unverifiedRoleId) {
            const unverifiedRole = guild.roles.cache.get(securityConfig.verification.unverifiedRoleId);
            if (unverifiedRole) {
                await category.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
                console.log(`Категория закрыта от роли ${unverifiedRole.name}`);
            }
        }

        // Панель открытия тикета — этот же канал теперь родитель для
        // приватных тредов-тикетов (createTicket создаёт тред прямо в
        // нём). Все 4 staff-роли получают ManageThreads, чтобы видеть и
        // открывать любой приватный тред канала без ручного добавления
        // в каждый — иначе пришлось бы add()'ить каждого сотрудника в
        // каждый новый тикет по отдельности. Раньше сюда попадал только
        // supportRole/betaSupportRole — Moderator и Beta-Moderator технически
        // проходили isStaff() (см. tickets/model.js, право ModerateMembers),
        // но физически не видели приватные треды без этого overwrite'а —
        // отдельная модерация (кик/бан/мут) не то же самое, что видимость
        // тикетов, Discord их не связывает.
        const panelStaffRoles = [supportRole, betaSupportRole, moderatorRole, betaModeratorRole].filter(Boolean);
        const { channel: panelChannel, created: panelChannelCreated } = await findOrCreateChannel({
            guild,
            existingId: config.panelChannelId,
            name: 'открыть-тикет',
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
                    ...panelStaffRoles.map(role => ({
                        id: role.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageThreads],
                    })),
                ],
            },
        });
        if (panelChannelCreated) {
            console.log('Создан канал: открыть-тикет');
        } else {
            console.log('Канал открыть-тикет уже настроен');
            for (const role of panelStaffRoles) {
                await panelChannel.permissionOverwrites
                    .edit(role.id, { ViewChannel: true, ManageThreads: true })
                    .catch(() => {});
            }
        }

        // Специалисты по темам (кроме bug — у неё своя отдельная панель
        // ниже, ей нечего делать на общей) получают тот же доступ, что и
        // supportRole — без ManageThreads на этом канале роль не увидит
        // приватный тред, в который её только пингнули.
        for (const [reasonValue, roleId] of Object.entries(reasonRoleIds)) {
            if (reasonValue === 'bug') continue;
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

        // Отдельная панель багов (standalone-тема "bug" в REASONS) — свой
        // канал в той же категории "Поддержка", видят Support/Moderator
        // (+beta) как и общую панель, плюс сама роль разработчика (у неё
        // на общей панели доступа больше нет, см. цикл выше). Support на
        // новые баг-тикеты не пингуется (tickets/model.js createTicket) —
        // это и была цель разделения, отдельная очередь для разработчика.
        const bugPanelStaffRoles = [...panelStaffRoles, developerRole].filter(Boolean);
        const { channel: bugPanelChannel, created: bugPanelChannelCreated } = await findOrCreateChannel({
            guild,
            existingId: config.bugPanelChannelId,
            name: 'сообщить-о-баге',
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
                    ...bugPanelStaffRoles.map(role => ({
                        id: role.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageThreads],
                    })),
                ],
            },
        });
        if (bugPanelChannelCreated) {
            console.log('Создан канал: сообщить-о-баге');
        } else {
            console.log('Канал сообщить-о-баге уже настроен');
            for (const role of bugPanelStaffRoles) {
                await bugPanelChannel.permissionOverwrites
                    .edit(role.id, { ViewChannel: true, ManageThreads: true })
                    .catch(() => {});
            }
        }

        const bugMessages = await bugPanelChannel.messages.fetch({ limit: 10 });
        const existingBugPanel = bugMessages.find(m => m.author.id === client.user.id && m.components.length > 0);
        if (existingBugPanel) {
            await existingBugPanel.edit({ ...buildBugPanelMessage(), embeds: [] });
            console.log('Панель багов обновлена.');
        } else {
            await bugPanelChannel.send(buildBugPanelMessage());
            console.log('Панель багов отправлена.');
        }

        // Роль Muted (moderation/model.js) запрещает SendMessagesInThreads
        // категорийным deny-оверрайтом почти везде на сервере — правильно
        // для обычных каналов, но ломает единственный смысл апелляции:
        // замученный автор не смог бы написать, что и как, в своём же
        // треде. Канальный allow всегда сильнее категорийного deny той же
        // роли (первенство Discord), поэтому явно возвращаем его здесь —
        // на обеих панелях тикетов, не только основной (баг-репорты через
        // Muted-роль тоже не должны быть заблокированы).
        const mutedRoleId = securityConfig.baseRoleIds?.Muted;
        if (mutedRoleId) {
            await panelChannel.permissionOverwrites.edit(mutedRoleId, { SendMessagesInThreads: true }).catch(() => {});
            await bugPanelChannel.permissionOverwrites
                .edit(mutedRoleId, { SendMessagesInThreads: true })
                .catch(() => {});
            console.log('Роль Muted может писать в тредах тикетов (для апелляций).');
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

        // Канал подтверждения стажёров — сюда падает embed с кнопками
        // "Подтвердить"/"Отклонить", когда Beta-Moderator/Beta-Support
        // запрашивает закрытие тикета (tickets/model.js
        // requestTicketClosure). Видят его только "старшие" — Support и
        // Moderator явными правами, Admin — как обычно, в обход
        // overwrite'ов через Administrator; стажёрские роли доступа не
        // получают, иначе могли бы сами себе подтвердить закрытие.
        const reviewOverwrites = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }];
        if (moderatorRole) {
            reviewOverwrites.push({
                id: moderatorRole.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            });
        }
        reviewOverwrites.push({
            id: supportRole.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        });
        const { channel: reviewChannel, created: reviewChannelCreated } = await findOrCreateChannel({
            guild,
            existingId: config.reviewChannelId,
            name: 'подтверждение-стажёров',
            type: ChannelType.GuildText,
            parentId: staffCategory?.id,
            createOptions: { permissionOverwrites: reviewOverwrites },
        });
        console.log(
            reviewChannelCreated ? 'Создан канал: подтверждение-стажёров' : 'Канал подтверждение-стажёров уже настроен'
        );

        config.categoryId = category.id;
        config.panelChannelId = panelChannel.id;
        config.bugPanelChannelId = bugPanelChannel.id;
        config.logChannelId = logChannel.id;
        config.reviewChannelId = reviewChannel.id;
        config.supportRoleId = supportRole.id;
        config.betaSupportRoleId = betaSupportRole.id;
        config.betaModeratorRoleId = betaModeratorRoleId;
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
