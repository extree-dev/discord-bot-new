require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, save } = require('../tickets/config');
const security = require('../security');
const { buildPanelMessage, buildBugPanelMessage } = require('../tickets');
const { findOrCreateChannel, findOrCreateRole } = require('../utils/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Роли-специалисты по темам — не каждый модератор из общего Support
// понимает, например, апелляции наказаний, поэтому submitForm()
// (tickets/model.js) дополнительно пингует нужную роль под темой
// (config.reasonRoleIds). Баг в самом боте — не вопрос модерации, а
// вопрос того, кто его написал, поэтому у темы "bug" не роль поддержки,
// а роль разработчика.
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
        const betaModeratorRoleId = securityConfig.baseRoleIds?.['Beta-Moderator'] ?? null;
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

        // роли-специалисты по темам — убранные темы просто перестают
        // отслеживаться и получать пинги; сами роли на сервере скрипт не
        // трогает и не удаляет, это на усмотрение администратора.
        const reasonRoleIds = {};
        for (const reasonValue of Object.keys(SPECIALIST_ROLES)) {
            if (config.reasonRoleIds[reasonValue]) reasonRoleIds[reasonValue] = config.reasonRoleIds[reasonValue];
        }
        const specialistRoles = [];
        // Роль-владелец отдельной очереди багов (standalone-тема, см.
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

        // категория
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

        // Панель открытия обращения — публичный канал, виден всем, писать
        // нельзя (только жать кнопки — Discord не блокирует кнопки/модалки
        // по отсутствию SendMessages). Никаких особых прав staff тут больше
        // не нужно — обращение больше не создаёт тред в этом канале, оно
        // сразу падает карточкой в submissionsChannel/bugChannel ниже.
        const { channel: panelChannel, created: panelChannelCreated } = await findOrCreateChannel({
            guild,
            existingId: config.panelChannelId,
            name: 'открыть-тикет',
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            },
        });
        if (panelChannelCreated) {
            console.log('Создан канал: открыть-тикет');
        } else {
            console.log('Канал открыть-тикет уже настроен');
        }

        const messages = await panelChannel.messages.fetch({ limit: 10 });
        const existingPanel = messages.find(m => m.author.id === client.user.id && m.components.length > 0);
        if (existingPanel) {
            // embeds: [] — старая панель (до перехода на Components V2)
            // была embed'ом; без явной очистки Discord отвергает PATCH,
            // который одновременно оставляет старый embed и включает флаг
            // IS_COMPONENTS_V2.
            await existingPanel.edit({ ...buildPanelMessage(), embeds: [] });
            console.log('Панель обращений обновлена.');
        } else {
            await panelChannel.send(buildPanelMessage());
            console.log('Панель обращений отправлена.');
        }

        // Отдельная публичная панель багов (standalone-тема "bug") — та же
        // логика: только кнопка, писать нельзя.
        const { channel: bugPanelChannel, created: bugPanelChannelCreated } = await findOrCreateChannel({
            guild,
            existingId: config.bugPanelChannelId,
            name: 'сообщить-о-баге',
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            },
        });
        if (bugPanelChannelCreated) {
            console.log('Создан канал: сообщить-о-баге');
        } else {
            console.log('Канал сообщить-о-баге уже настроен');
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

        // Приватный канал, куда падают карточки жалоб/апелляций/вопросов/
        // "другого" — видят только Support/Moderator(+Beta) и профильные
        // роли-специалисты (кроме bug, у неё свой канал ниже).
        const submissionsStaffRoles = [supportRole, moderatorRole, betaModeratorRole].filter(Boolean);
        const submissionsOverwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            ...submissionsStaffRoles.map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel] })),
        ];
        for (const [reasonValue, roleId] of Object.entries(reasonRoleIds)) {
            if (reasonValue === 'bug') continue;
            submissionsOverwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel] });
        }
        const { channel: submissionsChannel, created: submissionsChannelCreated } = await findOrCreateChannel({
            guild,
            existingId: config.submissionsChannelId,
            name: 'обращения-в-поддержку',
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: { permissionOverwrites: submissionsOverwrites },
        });
        if (submissionsChannelCreated) {
            console.log('Создан канал: обращения-в-поддержку');
        } else {
            console.log('Канал обращения-в-поддержку уже настроен');
            await submissionsChannel.permissionOverwrites
                .edit(guild.roles.everyone.id, { ViewChannel: false })
                .catch(() => {});
            for (const role of submissionsStaffRoles) {
                await submissionsChannel.permissionOverwrites.edit(role.id, { ViewChannel: true }).catch(() => {});
            }
            for (const [reasonValue, roleId] of Object.entries(reasonRoleIds)) {
                if (reasonValue === 'bug') continue;
                await submissionsChannel.permissionOverwrites.edit(roleId, { ViewChannel: true }).catch(() => {});
            }
        }

        // Приватный канал багов — видит роль разработчика и общий staff
        // (как и раньше), но пингуется на новые карточки только
        // разработчик (submitForm в tickets/model.js) — Support на баги в
        // самом боте не дёргаем.
        const bugStaffRoles = [...submissionsStaffRoles, developerRole].filter(Boolean);
        const { channel: bugChannel, created: bugChannelCreated } = await findOrCreateChannel({
            guild,
            existingId: config.bugChannelId,
            name: 'баг-репорты',
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    ...bugStaffRoles.map(role => ({ id: role.id, allow: [PermissionFlagsBits.ViewChannel] })),
                ],
            },
        });
        if (bugChannelCreated) {
            console.log('Создан канал: баг-репорты');
        } else {
            console.log('Канал баг-репорты уже настроен');
            for (const role of bugStaffRoles) {
                await bugChannel.permissionOverwrites.edit(role.id, { ViewChannel: true }).catch(() => {});
            }
        }

        config.categoryId = category.id;
        config.panelChannelId = panelChannel.id;
        config.bugPanelChannelId = bugPanelChannel.id;
        config.submissionsChannelId = submissionsChannel.id;
        config.bugChannelId = bugChannel.id;
        config.supportRoleId = supportRole.id;
        config.reasonRoleIds = reasonRoleIds;
        await save(config);

        console.log('Готово. Система обращений настроена.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки тикетов:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
