require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, save } = require('../tickets/config');
const security = require('../security');
const { buildPanelMessage } = require('../tickets');
const { findOrCreateChannel, findOrCreateRole } = require('../utils/idempotent');

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

        // Панель — публичный канал, виден всем, писать нельзя (только
        // жать кнопку — Discord не блокирует кнопки/модалки по отсутствию
        // SendMessages). Сам тикет открывается отдельным приватным тредом
        // в submissionsChannel ниже, не в этом канале.
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

        // Приватный канал-родитель для тредов жалоб — видят только
        // Support/Moderator(+Beta). ManageThreads (не только ViewChannel)
        // обязателен: без него роль не увидит приватные треды внутри,
        // куда пинг её только зовёт, а не добавляет в участники (та же
        // причина, что была у прежней thread-based системы тикетов).
        const submissionsStaffRoles = [supportRole, moderatorRole, betaModeratorRole].filter(Boolean);
        // Явный оверрайт на самого бота — иначе он видит канал только
        // если его собственная роль как-то попала в allow (не гарантия),
        // а thread.members.add() в tickets/model.js без ManageThreads
        // здесь бы падал (см. коммент там же про invitable).
        const submissionsOverwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageThreads] },
            ...submissionsStaffRoles.map(role => ({
                id: role.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageThreads],
            })),
        ];
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
            await submissionsChannel.permissionOverwrites
                .edit(client.user.id, { ViewChannel: true, ManageThreads: true })
                .catch(() => {});
            for (const role of submissionsStaffRoles) {
                await submissionsChannel.permissionOverwrites
                    .edit(role.id, { ViewChannel: true, ManageThreads: true })
                    .catch(() => {});
            }
        }

        // Роль Muted запрещает SendMessagesInThreads категорийным
        // deny-оверрайтом почти везде на сервере (см. moderation/model.js)
        // — без явного allow здесь замученный участник не смог бы писать
        // дальше в собственном же треде жалобы (та же грабля уже была у
        // прежней thread-based системы тикетов, канальный allow всегда
        // сильнее категорийного deny той же роли).
        const mutedRoleId = securityConfig.baseRoleIds?.Muted;
        if (mutedRoleId) {
            await submissionsChannel.permissionOverwrites
                .edit(mutedRoleId, { SendMessagesInThreads: true })
                .catch(() => {});
        }

        // Разовая самоисцеляющаяся очистка: по решению администратора
        // система тикетов сужена до одной темы (жалоба на игрока) — тема
        // "баг" со своей отдельной публичной панелью и приватным каналом
        // результатов убрана целиком. Если они уже созданы прошлым
        // деплоем — удаляем их с сервера; на свежем сервере (существующих
        // ID нет) блок ничего не делает.
        const staleBugChannelIds = [config.bugPanelChannelId, config.bugChannelId].filter(Boolean);
        for (const id of staleBugChannelIds) {
            const staleChannel = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
            if (!staleChannel) continue;
            const staleName = staleChannel.name;
            await staleChannel
                .delete('Тема "баг" убрана из системы тикетов')
                .then(() => console.log(`Удалён канал баг-репортов: ${staleName}`))
                .catch(err => console.error(`Не удалось удалить канал ${staleName}:`, err.message));
        }

        config.categoryId = category.id;
        config.panelChannelId = panelChannel.id;
        config.submissionsChannelId = submissionsChannel.id;
        config.supportRoleId = supportRole.id;
        config.bugPanelChannelId = null;
        config.bugChannelId = null;
        config.reasonRoleIds = undefined;
        await save(config);

        console.log('Готово. Система обращений настроена.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки тикетов:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
