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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        let unverifiedRole = guild.roles.cache.find(r => r.name === 'Unverified');
        if (!unverifiedRole) {
            unverifiedRole = await guild.roles.create({
                name: 'Unverified',
                color: 0x808080,
                hoist: false,
                mentionable: false,
                permissions: [],
            });
            console.log('Создана роль: Unverified');
        } else {
            console.log('Роль Unverified уже существует');
        }

        // Отдельная роль именно для "прошёл верификацию" — раньше скрипт
        // переиспользовал роль Participant из setup-roles.js, но это была
        // роль общего назначения, ничем не привязанная к смыслу "прошёл
        // капчу", и путалась с одноимённой ролью, которую администратор
        // мог создать вручную под тем же именем "Верифицирован".
        let verifiedRole = guild.roles.cache.find(r => r.name === 'Верифицирован');
        if (!verifiedRole) {
            verifiedRole = await guild.roles.create({
                name: 'Верифицирован',
                color: 0x57f287,
                hoist: false,
                mentionable: false,
                permissions: [],
            });
            console.log('Создана роль: Верифицирован');
        } else {
            console.log('Роль Верифицирован уже существует');
        }

        let category = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name === '🚪 Верификация'
        );
        if (!category) {
            category = await guild.channels.create({
                name: '🚪 Верификация',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: unverifiedRole.id, allow: [PermissionFlagsBits.ViewChannel] },
                ],
            });
            await category.setPosition(0);
            console.log('Создана категория: 🚪 Верификация');
        } else {
            console.log('Категория 🚪 Верификация уже существует');
        }

        let channel = guild.channels.cache.find(c => c.parentId === category.id && c.name === 'verification');
        if (!channel) {
            channel = await guild.channels.create({
                name: 'verification',
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    {
                        id: unverifiedRole.id,
                        allow: [PermissionFlagsBits.ViewChannel],
                        deny: [PermissionFlagsBits.SendMessages],
                    },
                ],
            });
            console.log('Создан канал: verification');
        } else {
            console.log('Канал verification уже существует');
        }

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
