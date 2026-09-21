require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const leveling = require('../leveling');
const { findOrCreateChannel, findOrCreateRole } = require('../utils/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CATEGORY_NAME = '📋 Информация';
// Те же имена канала/ролей, что были у прежней системы репутации
// (scripts/setup-reputation.js, удалён) — findOrCreateChannel/
// findOrCreateRole ищут по сохранённому ID, а при его отсутствии по
// имени, так что этот скрипт узнаёт и усыновляет уже существующие на
// сервере канал и роли уровней вместо создания дублей, хотя у самой
// фичи leveling/ свежий config-store без единого сохранённого ID.
const CHANNEL_NAME = 'рейтинг';

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const existingGuildConfig = await leveling.getGuildConfig(guild.id);

        const { channel: category, created: categoryCreated } = await findOrCreateChannel({
            guild,
            existingId: existingGuildConfig.categoryId,
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
        });
        if (categoryCreated) console.log(`Создана категория: ${CATEGORY_NAME}`);

        const { channel, created: channelCreated } = await findOrCreateChannel({
            guild,
            existingId: existingGuildConfig.announceChannelId,
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            parentId: category.id,
            createOptions: {
                permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }],
            },
        });
        if (channelCreated) {
            console.log(`Создан канал: ${CHANNEL_NAME}`);
        } else {
            console.log(`Канал топа активности уже настроен: ${channel.name}`);
            await channel.permissionOverwrites
                .edit(guild.roles.everyone.id, { SendMessages: false })
                .catch(err => console.error('Не удалось закрыть канал от записи:', err.message));
        }

        // Роль на каждый уровень, включая стартовый "Новичок" (LEVELS[0]) —
        // при верификации (см. security/verification.js), а не при первом
        // очке активности, поэтому она нужна с самого начала, не только
        // когда кто-то её "заслужит".
        const levelRoles = {};
        for (let i = 0; i < leveling.LEVELS.length; i++) {
            const level = leveling.LEVELS[i];
            const { role, created: roleCreated } = await findOrCreateRole({
                guild,
                existingId: existingGuildConfig.levelRoles?.[i],
                name: level.title,
                color: level.color,
                hoist: true,
                mentionable: false,
                permissions: [],
            });
            console.log(
                roleCreated ? `Создана роль уровня: ${level.title}` : `Роль уровня уже настроена: ${role.name}`
            );
            levelRoles[i] = role.id;
        }

        await leveling.configureGuild(guild.id, { channelId: channel.id, categoryId: category.id, levelRoles });

        console.log('Готово. Топ активности публикуется автоматически раз в неделю в канал #' + CHANNEL_NAME + '.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки уровней активности:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
