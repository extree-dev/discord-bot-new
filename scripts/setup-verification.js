require('dotenv').config({ quiet: true });
const {
    Client,
    GatewayIntentBits,
    ChannelType,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} = require('discord.js');
const security = require('../security');
const { COLORS, baseEmbed, formatBody } = require('../utils/embeds');
const { isBootstrap, ensureChannel, ensureRole, refreshPanel } = require('../utils/setupMode');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        // Если роль уже настроена явно (через /verification-role или
        // предыдущий запуск этого скрипта) и всё ещё существует — берём
        // именно её, не ищем по имени. Так администратор может назначить
        // любую свою роль, и скрипт никогда не создаст рядом дубликат.
        const existingConfig = await security.getConfig();

        const { role: unverifiedRole, created: unverifiedCreated } = await ensureRole({
            guild,
            existingId: existingConfig.verification.unverifiedRoleId,
            name: 'Unverified',
            color: 0x808080,
            hoist: false,
            mentionable: false,
            permissions: [],
        });
        if (unverifiedRole) {
            console.log(
                unverifiedCreated
                    ? 'Создана роль: Unverified'
                    : `Роль для "не верифицирован" уже настроена: ${unverifiedRole.name}`
            );
        }

        const { role: verifiedRole, created: verifiedCreated } = await ensureRole({
            guild,
            existingId: existingConfig.verification.verifiedRoleId,
            name: 'Верифицирован',
            color: 0x57f287,
            hoist: false,
            mentionable: false,
            permissions: [],
        });
        if (verifiedRole) {
            console.log(
                verifiedCreated
                    ? 'Создана роль: Верифицирован'
                    : `Роль для "верифицирован" уже настроена: ${verifiedRole.name}`
            );
        }

        const hiddenFromAllButUnverified = unverifiedRole
            ? [
                  { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                  { id: unverifiedRole.id, allow: [PermissionFlagsBits.ViewChannel] },
              ]
            : [];

        const { channel: category, created: categoryCreated } = await ensureChannel({
            guild,
            existingId: existingConfig.verification.categoryId,
            name: '🚪 Верификация',
            type: ChannelType.GuildCategory,
            createOptions: { permissionOverwrites: hiddenFromAllButUnverified },
        });
        if (categoryCreated) {
            await category.setPosition(0);
            console.log('Создана категория: 🚪 Верификация');
        } else if (category) {
            console.log('Категория 🚪 Верификация уже настроена');
        }

        const { channel, created: channelCreated } = category
            ? await ensureChannel({
                  guild,
                  existingId: existingConfig.verification.channelId,
                  name: 'verification',
                  type: ChannelType.GuildText,
                  parentId: category.id,
                  createOptions: {
                      permissionOverwrites: unverifiedRole
                          ? [
                                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                                {
                                    id: unverifiedRole.id,
                                    allow: [PermissionFlagsBits.ViewChannel],
                                    deny: [PermissionFlagsBits.SendMessages],
                                },
                            ]
                          : [],
                  },
              })
            : { channel: null, created: false };
        if (channel) console.log(channelCreated ? 'Создан канал: verification' : 'Канал verification уже настроен');

        // Закрыть остальные категории от Unverified — только при первичной
        // настройке. Раньше это делалось на каждом деплое и заново закрывало
        // категории, которые администратор открыл для новичков вручную.
        if (isBootstrap() && unverifiedRole && category) {
            const otherCategories = guild.channels.cache.filter(
                c => c.type === ChannelType.GuildCategory && c.id !== category.id
            );
            for (const cat of otherCategories.values()) {
                await cat.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false }).catch(err => {
                    console.error(`Не удалось закрыть категорию ${cat.name} от Unverified:`, err.message);
                });
            }
            console.log(`Закрыто категорий от Unverified: ${otherCategories.size}`);
        }

        if (channel) {
            const embed = baseEmbed(COLORS.primary)
                .setDescription(
                    formatBody(
                        'Добро пожаловать на сервер',
                        'Прежде чем получить доступ ко всем каналам, подтверди, что ты не бот.\n\nНажми на кнопку ниже — появится картинка с кодом, выбери его среди кнопок под картинкой. Это займёт пару секунд.'
                    )
                )
                .setThumbnail(guild.iconURL() ?? null)
                .setFooter({ text: guild.name });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(security.VERIFY_BUTTON_ID)
                    .setLabel('Пройти верификацию')
                    .setStyle(ButtonStyle.Success)
            );

            await refreshPanel({
                channel,
                botId: client.user.id,
                payload: { embeds: [embed], components: [row] },
                label: 'Верификация',
            });
        }

        // Точечно — только ID. Раньше здесь целиком перезаписывался объект
        // verification с enabled: true, из-за чего каждый деплой включал
        // модуль обратно после выключения через панель администратора и
        // сбрасывал настройки капчи к значениям по умолчанию.
        await security.updateConfig(config => {
            const verification = config.verification;
            const firstSetup = !verification.channelId;
            if (unverifiedRole) verification.unverifiedRoleId = unverifiedRole.id;
            if (verifiedRole) verification.verifiedRoleId = verifiedRole.id;
            if (channel) verification.channelId = channel.id;
            if (category) verification.categoryId = category.id;
            if (isBootstrap() && firstSetup && channel) verification.enabled = true;
        });

        console.log('Готово.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки верификации:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
