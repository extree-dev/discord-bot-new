require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const rolePanel = require('../rolePanel');
const { GAMES } = require('../gameNews/games');
const { findRole } = require('../utils/idempotent');
const { ensureChannel, refreshPanel } = require('../utils/setupMode');
const { toMessage } = require('../utils/components');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Та же категория, что и у "рейтинг" (scripts/setup-leveling.js) —
// общий хаб самостоятельных информационных каналов.
const CATEGORY_NAME = '📋 Информация';
const CHANNEL_NAME = 'выбор-ролей';

// Роли игр панель не создаёт — они уже заведены адаптацией
// (scripts/add-onboarding-role-questions.js), здесь только находим их
// по имени. Игра без найденной роли не попадает в панель совсем (не
// показываем участнику пункт меню, который ничего не сделает).
client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const existing = await rolePanel.getConfig();

        const { channel: category, created: categoryCreated } = await ensureChannel({
            guild,
            existingId: existing.categoryId,
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
        });
        if (categoryCreated) console.log(`Создана категория: ${CATEGORY_NAME}`);

        const { channel, created } = await ensureChannel({
            guild,
            existingId: existing.channelId,
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            parentId: category?.id,
        });
        if (!channel) {
            console.error(`Канал "${CHANNEL_NAME}" не найден и не создан — панель ролей не настроена.`);
            process.exit(1);
        }
        if (created) console.log(`Создан канал: ${CHANNEL_NAME}`);

        const roleIds = { ...existing.roleIds };
        const availableGames = [];
        for (const game of GAMES) {
            const role = findRole({ guild, existingId: existing.roleIds[game.key], name: game.name });
            if (!role) {
                console.warn(`Роль "${game.name}" не найдена — игра не попадёт в панель выбора ролей.`);
                continue;
            }
            roleIds[game.key] = role.id;
            availableGames.push(game);
        }

        await rolePanel.saveTargets({
            categoryId: category?.id ?? existing.categoryId,
            channelId: channel.id,
            roleIds,
        });

        if (availableGames.length === 0) {
            console.warn('Ни одна роль игры не найдена — панель не опубликована.');
            process.exit(0);
        }

        await refreshPanel({
            channel,
            botId: client.user.id,
            payload: toMessage(rolePanel.buildPanelMessage(availableGames)),
            label: 'Панель выбора игровых ролей',
        });

        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки панели выбора игровых ролей:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
