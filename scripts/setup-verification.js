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
const { findOrCreateChannel, findOrCreateRole } = require('../utils/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        // Если роль уже настроена явно (через /verification-role или
        // предыдущий запуск этого скрипта) и всё ещё существует — берём
        // именно её, не ищем по имени. Так администратор может назначить
        // любую свою роль (например, ID, присланный вручную), и скрипт
        // никогда не создаст рядом дубликат с похожим именем, даже если
        // имя реальной роли отличается от того, что ищется по умолчанию.
        const existingConfig = await security.getConfig();

        const { role: unverifiedRole, created: unverifiedCreated } = await findOrCreateRole({
            guild,
            existingId: existingConfig.verification.unverifiedRoleId,
            name: 'Unverified',
            color: 0x808080,
            hoist: false,
            mentionable: false,
            permissions: [],
        });
        console.log(
            unverifiedCreated
                ? 'Создана роль: Unverified'
                : `Роль для "не верифицирован" уже настроена: ${unverifiedRole.name}`
        );

        const { role: verifiedRole, created: verifiedCreated } = await findOrCreateRole({
            guild,
            existingId: existingConfig.verification.verifiedRoleId,
            name: 'Верифицирован',
            color: 0x57f287,
            hoist: false,
            mentionable: false,
            permissions: [],
        });
        console.log(
            verifiedCreated
                ? 'Создана роль: Верифицирован'
                : `Роль для "верифицирован" уже настроена: ${verifiedRole.name}`
        );

        const { channel: category, created: categoryCreated } = await findOrCreateChannel({
            guild,
            existingId: existingConfig.verification.categoryId,
            name: '🚪 Верификация',
            type: ChannelType.GuildCategory,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: unverifiedRole.id, allow: [PermissionFlagsBits.ViewChannel] },
                ],
            },
        });
        if (categoryCreated) {
            await category.setPosition(0);
            console.log('Создана категория: 🚪 Верификация');
        } else {
            console.log('Категория 🚪 Верификация уже настроена');
        }

        const { channel, created: channelCreated } = await findOrCreateChannel({
            guild,
            existingId: existingConfig.verification.channelId,
            name: 'verification',
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: {
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    {
                        id: unverifiedRole.id,
                        allow: [PermissionFlagsBits.ViewChannel],
                        deny: [PermissionFlagsBits.SendMessages],
                    },
                ],
            },
        });
        console.log(channelCreated ? 'Создан канал: verification' : 'Канал verification уже настроен');

        // Закрываем остальные существующие категории от Unverified
        await guild.channels.fetch();
        const otherCategories = guild.channels.cache.filter(
            c => c.type === ChannelType.GuildCategory && c.id !== category.id
        );
        for (const cat of otherCategories.values()) {
            await cat.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false }).catch(err => {
                console.error(`Не удалось закрыть категорию ${cat.name} от Unverified:`, err.message);
            });
        }
        console.log(`Закрыто категорий от Unverified: ${otherCategories.size}`);

        const embed = baseEmbed(COLORS.primary)
            .setDescription(
                formatBody(
                    'Добро пожаловать на сервер',
                    'Прежде чем получить доступ ко всем каналам, подтверди, что ты не бот.\n\nНажми на кнопку ниже и реши простой пример — это займёт пару секунд.'
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

        const existingMessages = await channel.messages.fetch({ limit: 10 });
        const existingPanel = existingMessages.find(m => m.author.id === client.user.id && m.components.length > 0);
        if (existingPanel) {
            await existingPanel.edit({ embeds: [embed], components: [row] });
            console.log('Сообщение с кнопкой верификации обновлено.');
        } else {
            await channel.send({ embeds: [embed], components: [row] });
            console.log('Сообщение с кнопкой верификации отправлено.');
        }

        await security.updateConfig(config => {
            config.verification = {
                enabled: true,
                unverifiedRoleId: unverifiedRole.id,
                verifiedRoleId: verifiedRole.id,
                channelId: channel.id,
                categoryId: category.id,
            };
        });

        console.log('Готово. Верификация настроена и включена.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки верификации:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
