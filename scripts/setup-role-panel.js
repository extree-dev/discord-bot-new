require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const rolePanel = require('../rolePanel');
const { GAMES } = require('../gameNews/games');
const { PALETTE, roleName } = require('../rolePanel/colors');
const { findRole } = require('../utils/idempotent');
const { ensureChannel, ensureRole, refreshPanel } = require('../utils/setupMode');
const { toMessage } = require('../utils/components');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Та же категория, что и у "рейтинг" (scripts/setup-leveling.js) —
// общий хаб самостоятельных информационных каналов.
const CATEGORY_NAME = '📋 Информация';
const CHANNEL_NAME = 'выбор-ролей';

// Возвращает кастомный эмодзи сервера по имени (item.customEmojiName —
// тот же, что и у игровой роли в scripts/add-onboarding-role-
// questions.js, и залитый scripts/upload-color-emojis.js у роли-цвета),
// если он есть — иначе юникод-эмодзи item.emoji. StringSelectMenu умеет
// показывать кастомные эмодзи (в отличие от названий каналов — там
// работает только юникод, см. gameNews/games.js), поэтому эта замена
// только для панели. Общая для игр (GAMES) и цветов (PALETTE) — обе
// формы {name, emoji, customEmojiName}.
function resolveEmoji(guild, item) {
    if (item.customEmojiName) {
        const custom = guild.emojis.cache.find(e => e.name === item.customEmojiName);
        if (custom) return { id: custom.id, name: custom.name };
        console.warn(
            `Кастомный эмодзи ":${item.customEmojiName}:" не найден на сервере — для "${item.name}" в панели использую стандартный ${item.emoji}.`
        );
    }
    return item.emoji;
}

// Роли игр панель не создаёт — они уже заведены адаптацией
// (scripts/add-onboarding-role-questions.js), здесь только находим их
// по имени. Игра без найденной роли не попадает в панель совсем (не
// показываем участнику пункт меню, который ничего не сделает).
client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();
        await guild.emojis.fetch();

        const existing = await rolePanel.getConfig();

        const { channel: category, created: categoryCreated } = await ensureChannel({
            guild,
            existingId: existing.categoryId,
            name: CATEGORY_NAME,
            type: ChannelType.GuildCategory,
        });
        if (categoryCreated) console.log(`Создана категория: ${CATEGORY_NAME}`);

        // Как и у остальных scripts/setup-*.js (см. utils/setupMode.js):
        // отсутствие канала в режиме синхронизации — это не ошибка деплоя,
        // а нормальное состояние до первого ручного --bootstrap. Раньше
        // здесь был process.exit(1), из-за чего деплой падал целиком на
        // каждом прогоне до тех пор, пока администратор не запустит
        // --bootstrap вручную (см. CHANGELOG).
        const { channel, created } = await ensureChannel({
            guild,
            existingId: existing.channelId,
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            parentId: category?.id,
        });
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
            availableGames.push({ ...game, emoji: resolveEmoji(guild, game) });
        }

        // Роли-цвета — в отличие от игровых, панель их сама и создаёт
        // (--bootstrap): больше никто эти роли не использует, чужого
        // ID/имени, заведённого другой фичей, тут нет. Позицию в
        // иерархии (выше ярусов активности, см. rolePanel/colors.js)
        // выставляет отдельно scripts/reorganize-custom-roles.js — сам
        // Discord создаёт новую роль сразу над @everyone.
        const colorRoleIds = { ...existing.colorRoleIds };
        const availableColors = [];
        for (const color of PALETTE) {
            const { role, created } = await ensureRole({
                guild,
                existingId: existing.colorRoleIds[color.key],
                name: roleName(color),
                color: color.hex,
                hoist: false,
                mentionable: false,
                permissions: [],
            });
            if (!role) continue;
            if (created) {
                console.log(`Создана роль цвета: ${role.name}`);
            } else if (role.name !== roleName(color)) {
                // Роль-цвет — целиком наша (см. комментарий выше, ей не
                // управляет никто, кроме этого скрипта), поэтому в отличие
                // от чужих ролей (Moderator и т.п., см. utils/idempotent.js)
                // переименование в код-текущее имя тут безопасно — это не
                // затирает ручную правку администратора, а просто держит
                // роль в синхроне с текущим неймингом (например, убрали
                // префикс "Цвет: " по прямому запросу администратора).
                const oldName = role.name;
                await role.setName(roleName(color), 'Синхронизация имени роли-цвета с кодом панели');
                console.log(`Переименована роль цвета: "${oldName}" → "${role.name}".`);
            }
            colorRoleIds[color.key] = role.id;
            availableColors.push({ ...color, emoji: resolveEmoji(guild, color) });
        }

        await rolePanel.saveTargets({
            categoryId: category?.id ?? existing.categoryId,
            channelId: channel?.id ?? existing.channelId,
            roleIds,
            colorRoleIds,
        });

        if (!channel) {
            console.warn('Канал панели не найден — панель не опубликована.');
            process.exit(0);
        }
        if (availableGames.length === 0 && availableColors.length === 0) {
            console.warn('Ни одна роль (игровая или цвет) не найдена — панель не опубликована.');
            process.exit(0);
        }

        await refreshPanel({
            channel,
            botId: client.user.id,
            payload: toMessage(
                rolePanel.buildPanelMessage({
                    playGames: availableGames,
                    colors: availableColors,
                })
            ),
            label: 'Панель выбора игровых ролей',
        });

        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки панели выбора игровых ролей:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
