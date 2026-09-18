require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { load, save } = require('../voice/config');
const security = require('../security');
const { buildPanelMessage } = require('../voice');
const { findOrCreateChannel } = require('./lib/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Если уже настроен ID (через предыдущий запуск или админ-команду, например
// /temp-voice-category) — используем именно этот канал как есть, не
// переименовывая его на дефолтное имя. Раньше здесь было принудительное
// setName() при несовпадении, из-за чего категория, которую администратор
// указал вручную под своим именем, откатывалась обратно на "Активные
// комнаты" на следующем деплое (тот же класс багов, что был у ролей
// верификации — см. scripts/setup-verification.js).
async function findOrCreate({ guild, config, idKey, name, type, parentId }) {
    const { channel, created } = await findOrCreateChannel({ guild, existingId: config[idKey], name, type, parentId });
    console.log(created ? `Создан: ${name}` : `Уже настроено: ${channel.name}`);
    return channel;
}

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();

        const config = await load();

        const category = await findOrCreate({
            guild,
            config,
            idKey: 'categoryId',
            name: 'Временные комнаты',
            type: ChannelType.GuildCategory,
        });

        const controlChannel = await findOrCreate({
            guild,
            config,
            idKey: 'controlChannelId',
            name: 'управление-комнатой',
            type: ChannelType.GuildText,
            parentId: category.id,
        });

        const trigger = await findOrCreate({
            guild,
            config,
            idKey: 'triggerChannelId',
            name: 'Создать комнату',
            type: ChannelType.GuildVoice,
            parentId: category.id,
        });

        if (controlChannel.parentId !== category.id) await controlChannel.setParent(category.id).catch(() => {});
        if (trigger.parentId !== category.id) await trigger.setParent(category.id).catch(() => {});
        await controlChannel.setPosition(0).catch(() => {});

        // Отдельная категория для самих временных комнат участников —
        // раньше voice/model.js createRoom() создавал их в той же
        // категории, что триггер-канал и панель управления (categoryId),
        // и та категория зарастала десятками комнат. roomsCategoryId
        // указывает на новую, отдельную категорию именно для этого.
        const roomsCategory = await findOrCreate({
            guild,
            config,
            idKey: 'roomsCategoryId',
            name: 'Активные комнаты',
            type: ChannelType.GuildCategory,
        });

        const securityConfig = await security.getConfig();
        if (securityConfig.verification.unverifiedRoleId) {
            const unverifiedRole = guild.roles.cache.get(securityConfig.verification.unverifiedRoleId);
            if (unverifiedRole) {
                await category.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
                await roomsCategory.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
                console.log(`Категории закрыты от роли ${unverifiedRole.name}`);
            }
        }

        const messages = await controlChannel.messages.fetch({ limit: 10 });
        const existingPanel = messages.find(m => m.author.id === client.user.id && m.components.length > 0);
        if (existingPanel) {
            // embeds: [] — старая панель была embed'ом; без явной очистки
            // Discord отвергает PATCH, включающий флаг IS_COMPONENTS_V2 на
            // сообщении, у которого остаётся старый embed (см. тот же баг,
            // пойманный на панели тикетов).
            await existingPanel.edit({ ...buildPanelMessage(), embeds: [] });
            console.log('Панель управления обновлена.');
        } else {
            await controlChannel.send(buildPanelMessage());
            console.log('Панель управления отправлена.');
        }

        config.categoryId = category.id;
        config.roomsCategoryId = roomsCategory.id;
        config.triggerChannelId = trigger.id;
        config.controlChannelId = controlChannel.id;
        await save(config);

        console.log('Готово. Временные комнаты настроены (лимит по умолчанию: 5 человек).');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки временных комнат:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
