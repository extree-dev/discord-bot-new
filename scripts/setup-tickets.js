require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const { load, update } = require('../tickets/config');
const security = require('../security');
const { buildPanelMessage } = require('../tickets');
const { isBootstrap, ensureChannel, ensureRole, refreshPanel } = require('../utils/setupMode');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        // Только для чтения сохранённых ID — записываем ниже точечно через
        // update(): в этом же сторе лежат живые тикеты (ticketsById,
        // counter), которые работающий бот может менять прямо во время
        // деплоя; перезапись всего конфига целиком их бы затирала.
        const config = await load();
        const securityConfig = await security.getConfig();
        const moderatorRole = guild.roles.cache.find(r => r.name === 'Moderator');
        const betaModeratorRoleId = securityConfig.baseRoleIds?.['Beta-Moderator'] ?? null;
        const betaModeratorRole = betaModeratorRoleId ? guild.roles.cache.get(betaModeratorRoleId) : null;

        // роль поддержки
        const { role: supportRole, created: supportCreated } = await ensureRole({
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
        } else if (supportRole) {
            console.log(`Роль Support уже настроена: ${supportRole.name}`);
        }

        // Beta-Support — стажёрский состав поддержки: может брать тикеты в
        // работу наравне с Support/Beta-Moderator, но закрывать их сам не
        // может — нужно подтверждение старшего состава (см. isSeniorStaff в
        // tickets/model.js).
        const { role: betaSupportRole, created: betaSupportCreated } = await ensureRole({
            guild,
            existingId: config.betaSupportRoleId,
            name: 'Beta-Support',
            color: 0x2ecc71,
            hoist: true,
            mentionable: false,
            permissions: [],
        });
        if (betaSupportCreated) {
            console.log('Создана роль: Beta-Support');
            if (supportRole) await betaSupportRole.setPosition(supportRole.position - 1).catch(() => {});
        } else if (betaSupportRole) {
            console.log(`Роль Beta-Support уже настроена: ${betaSupportRole.name}`);
        }

        // категория
        const { channel: category, created: categoryCreated } = await ensureChannel({
            guild,
            existingId: config.categoryId,
            name: 'Поддержка',
            type: ChannelType.GuildCategory,
        });
        if (category)
            console.log(categoryCreated ? 'Создана категория: Поддержка' : 'Категория Поддержка уже настроена');

        const unverifiedRole = securityConfig.verification.unverifiedRoleId
            ? guild.roles.cache.get(securityConfig.verification.unverifiedRoleId)
            : null;
        if (isBootstrap() && category && unverifiedRole) {
            await category.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
            console.log(`Категория закрыта от роли ${unverifiedRole.name}`);
        }

        // Панель — публичный канал, виден всем, писать нельзя (только
        // жать кнопку — Discord не блокирует кнопки/модалки по отсутствию
        // SendMessages). Сам тикет открывается отдельным приватным тредом
        // в submissionsChannel ниже, не в этом канале.
        const { channel: panelChannel, created: panelChannelCreated } = category
            ? await ensureChannel({
                  guild,
                  existingId: config.panelChannelId,
                  name: 'открыть-тикет',
                  type: ChannelType.GuildText,
                  parentId: category.id,
                  createOptions: {
                      permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
                  },
              })
            : { channel: null, created: false };
        if (panelChannel) {
            console.log(panelChannelCreated ? 'Создан канал: открыть-тикет' : 'Канал открыть-тикет уже настроен');
            // embeds: [] — старая панель (до перехода на Components V2)
            // была embed'ом; без явной очистки Discord отвергает PATCH,
            // который одновременно оставляет старый embed и включает флаг
            // IS_COMPONENTS_V2.
            await refreshPanel({
                channel: panelChannel,
                botId: client.user.id,
                payload: { ...buildPanelMessage(), embeds: [] },
                label: 'Обращения',
            });
        }

        // Приватный канал-родитель для тредов жалоб — видят только
        // Support/Moderator(+Beta). ManageThreads (не только ViewChannel)
        // обязателен: без него роль не увидит приватные треды внутри.
        // Явный оверрайт на самого бота — иначе thread.members.add() в
        // tickets/model.js без ManageThreads здесь бы падал.
        const submissionsStaffRoles = [supportRole, betaSupportRole, moderatorRole, betaModeratorRole].filter(Boolean);
        const submissionsOverwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageThreads] },
            ...submissionsStaffRoles.map(role => ({
                id: role.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageThreads],
            })),
        ];
        const { channel: submissionsChannel, created: submissionsChannelCreated } = category
            ? await ensureChannel({
                  guild,
                  existingId: config.submissionsChannelId,
                  name: 'обращения-в-поддержку',
                  type: ChannelType.GuildText,
                  parentId: category.id,
                  createOptions: { permissionOverwrites: submissionsOverwrites },
              })
            : { channel: null, created: false };
        if (submissionsChannel) {
            console.log(
                submissionsChannelCreated
                    ? 'Создан канал: обращения-в-поддержку'
                    : 'Канал обращения-в-поддержку уже настроен'
            );
        }

        if (isBootstrap() && submissionsChannel) {
            if (!submissionsChannelCreated) {
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
            // deny-оверрайтом почти везде (см. moderation/model.js) — без
            // явного allow здесь замученный участник не смог бы писать в
            // собственном треде жалобы (канальный allow сильнее категорийного
            // deny той же роли).
            const mutedRoleId = securityConfig.baseRoleIds?.Muted;
            if (mutedRoleId) {
                await submissionsChannel.permissionOverwrites
                    .edit(mutedRoleId, { SendMessagesInThreads: true })
                    .catch(() => {});
            }
        }

        await update(cfg => {
            if (category) cfg.categoryId = category.id;
            if (panelChannel) cfg.panelChannelId = panelChannel.id;
            if (submissionsChannel) cfg.submissionsChannelId = submissionsChannel.id;
            if (supportRole) cfg.supportRoleId = supportRole.id;
            if (betaSupportRole) cfg.betaSupportRoleId = betaSupportRole.id;
        });

        console.log('Готово. Система обращений настроена.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки тикетов:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
