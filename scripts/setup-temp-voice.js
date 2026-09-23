require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { load, update } = require('../voice/config');
const security = require('../security');
const { buildPanelMessage } = require('../voice');
const { isBootstrap, ensureChannel, refreshPanel } = require('../utils/setupMode');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Если ID уже сохранён (предыдущий запуск или /temp-voice-category) —
// используем именно этот канал как есть, не переименовывая его на
// дефолтное имя.
async function find({ guild, config, idKey, name, type, parentId }) {
    const { channel, created } = await ensureChannel({ guild, existingId: config[idKey], name, type, parentId });
    if (channel) console.log(created ? `Создан: ${name}` : `Уже настроено: ${channel.name}`);
    return channel;
}

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();

        // Только для чтения сохранённых ID — записываем ниже точечно через
        // update(): в этом же сторе лежит список живых комнат (channels),
        // который работающий бот меняет прямо во время деплоя. Раньше здесь
        // был save() всего конфига целиком, и комната, созданная в эти
        // секунды, выпадала из учёта и больше никогда не удалялась сама.
        const config = await load();

        const category = await find({
            guild,
            config,
            idKey: 'categoryId',
            name: 'Временные комнаты',
            type: ChannelType.GuildCategory,
        });

        const controlChannel = category
            ? await find({
                  guild,
                  config,
                  idKey: 'controlChannelId',
                  name: 'управление-комнатой',
                  type: ChannelType.GuildText,
                  parentId: category.id,
              })
            : null;

        const trigger = category
            ? await find({
                  guild,
                  config,
                  idKey: 'triggerChannelId',
                  name: 'Создать комнату',
                  type: ChannelType.GuildVoice,
                  parentId: category.id,
              })
            : null;

        // Отдельная категория для самих временных комнат участников, чтобы
        // категория с триггером и панелью не зарастала комнатами.
        const roomsCategory = await find({
            guild,
            config,
            idKey: 'roomsCategoryId',
            name: 'Активные комнаты',
            type: ChannelType.GuildCategory,
        });

        // Расстановка по категориям/позициям и закрытие от Unverified —
        // только при первичной настройке, не на каждом деплое.
        if (isBootstrap()) {
            if (controlChannel && controlChannel.parentId !== category.id) {
                await controlChannel.setParent(category.id).catch(() => {});
            }
            if (trigger && trigger.parentId !== category.id) await trigger.setParent(category.id).catch(() => {});
            if (controlChannel) await controlChannel.setPosition(0).catch(() => {});

            const securityConfig = await security.getConfig();
            const unverifiedRole = securityConfig.verification.unverifiedRoleId
                ? guild.roles.cache.get(securityConfig.verification.unverifiedRoleId)
                : null;
            if (unverifiedRole) {
                for (const cat of [category, roomsCategory].filter(Boolean)) {
                    await cat.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
                }
                console.log(`Категории закрыты от роли ${unverifiedRole.name}`);
            }
        }

        if (controlChannel) {
            // embeds: [] — старая панель была embed'ом; без явной очистки
            // Discord отвергает PATCH, включающий флаг IS_COMPONENTS_V2.
            await refreshPanel({
                channel: controlChannel,
                botId: client.user.id,
                payload: { ...buildPanelMessage(), embeds: [] },
                label: 'Временные комнаты',
            });
        }

        await update(cfg => {
            if (category) cfg.categoryId = category.id;
            if (roomsCategory) cfg.roomsCategoryId = roomsCategory.id;
            if (trigger) cfg.triggerChannelId = trigger.id;
            if (controlChannel) cfg.controlChannelId = controlChannel.id;
        });

        console.log('Готово. Временные комнаты настроены.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки временных комнат:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
