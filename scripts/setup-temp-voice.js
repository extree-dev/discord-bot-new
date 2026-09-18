require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { load, save } = require('../voice/config');
const security = require('../security');
const { buildPanelMessage } = require('../voice');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function findOrCreate({ guild, config, idKey, name, type, parentId }) {
    const existingById = config[idKey] ? guild.channels.cache.get(config[idKey]) : null;
    if (existingById) {
        if (existingById.name !== name) {
            await existingById.setName(name).catch(() => {});
            console.log(`Переименовано: "${existingById.name}" -> "${name}"`);
        } else {
            console.log(`Уже существует: ${name}`);
        }
        return existingById;
    }

    const byName = guild.channels.cache.find(
        c => c.type === type && c.name === name && (!parentId || c.parentId === parentId)
    );
    if (byName) {
        console.log(`Найден по имени: ${name}`);
        return byName;
    }

    const created = await guild.channels.create({ name, type, parent: parentId ?? null });
    console.log(`Создан: ${name}`);
    return created;
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

        const securityConfig = await security.getConfig();
        if (securityConfig.verification.unverifiedRoleId) {
            const unverifiedRole = guild.roles.cache.get(securityConfig.verification.unverifiedRoleId);
            if (unverifiedRole) {
                await category.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
                console.log(`Категория закрыта от роли ${unverifiedRole.name}`);
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
