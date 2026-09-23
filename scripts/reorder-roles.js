require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits } = require('discord.js');
const { pickOldest } = require('../utils/idempotent');
const { computeFullOrderPositions } = require('../utils/roleHierarchy');

// Полная расстановка ролей сервера по списку, согласованному с
// администратором, и "отображать отдельно" по группам. Не входит в
// деплой — разовое ручное действие. Без флага только показывает, что
// изменит; применяет с --apply:
//   docker compose run --rm bot node scripts/reorder-roles.js
//   docker compose run --rm bot node scripts/reorder-roles.js --apply
//
// Роль бота (самая верхняя) не двигается — бот не может менять роли на
// своём уровне и выше. Роли, которых нет в списке, не теряются: встают
// сразу под составом, в прежнем порядке, и перечисляются в выводе.
const GROUPS = [
    {
        title: 'Состав',
        hoist: true,
        roles: ['Administrator', 'Разработчик бота', 'Moderator', 'Beta-Moderator', 'Support', 'Beta-Support'],
    },
    {
        title: 'Особые',
        hoist: true,
        roles: [
            'Server Booster',
            'Twitch Subscriber: Tier 3',
            'Twitch Subscriber: Tier 2',
            'Twitch Subscriber: Tier 1',
            'Twitch Subscriber',
        ],
    },
    {
        title: 'Игры',
        hoist: true,
        roles: ['Valorant', 'CS2', 'War Thunder', 'Call of Duty', 'Dota 2', 'Apex Legends', 'Minecraft', 'GTA'],
    },
    {
        title: 'Уровни',
        hoist: false,
        roles: ['Хранитель', 'Мастер', 'Специалист', 'Боец', 'Рекрут', 'Путник', 'Новичок'],
    },
    { title: 'Подписки', hoist: false, roles: ['Новости сервера', 'Игровые новости'] },
    { title: 'Время онлайна', hoist: false, roles: ['Жаворонок', 'Совунья'] },
    { title: 'Интересы', hoist: false, roles: ['Геймер', 'Творец', 'Болтун', 'Меломан'] },
    {
        title: 'Архив',
        hoist: false,
        roles: ['Активный', 'Тихий наблюдатель', 'Воин', 'Страж', 'Стрелок', 'Маг'],
    },
    { title: 'Служебные', hoist: false, roles: ['Verified', 'Unverified', 'Trusted', 'Muted'] },
];

const APPLY = process.argv.includes('--apply');
const REASON = 'Перестановка ролей по списку администратора';

function findRoleByName(guild, name) {
    const matches = [...guild.roles.cache.filter(r => r.name === name).values()];
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    const canonical = pickOldest(matches);
    console.warn(`Ролей "${name}" несколько (${matches.length}) — беру самую старую (${canonical.id}).`);
    return canonical;
}

async function reorderRoles(guild) {
    await guild.roles.fetch();
    const me = await guild.members.fetchMe();
    const botPosition = me.roles.highest.position;

    const hoistById = new Map();
    const groupById = new Map();
    const orderedIds = [];
    let missing = 0;
    for (const group of GROUPS) {
        for (const name of group.roles) {
            const role = findRoleByName(guild, name);
            if (!role) {
                console.warn(`Роль "${name}" не найдена — пропускаю (не создаю).`);
                missing++;
                continue;
            }
            if (role.position >= botPosition) {
                console.error(`Роль "${name}" на уровне роли бота или выше — бот не может её двигать, прерываю.`);
                process.exitCode = 1;
                return;
            }
            orderedIds.push(role.id);
            hoistById.set(role.id, group.hoist);
            groupById.set(role.id, group.title);
        }
    }

    const staffCount = orderedIds.filter(id => groupById.get(id) === 'Состав').length;
    const { order, unlisted, positions } = computeFullOrderPositions({
        roles: [...guild.roles.cache.values()].map(r => ({ id: r.id, position: r.position })),
        orderedIds,
        afterCount: staffCount,
        botPosition,
        everyoneId: guild.roles.everyone.id,
    });

    console.log(`${APPLY ? 'Применяю' : 'Предпросмотр (ничего не меняю)'}. Роль бота: ${me.roles.highest.name}.`);
    console.log('Итоговый порядок сверху вниз:');
    let lastGroup = null;
    for (const [i, id] of order.entries()) {
        const role = guild.roles.cache.get(id);
        const group = groupById.get(id) ?? 'Нет в списке';
        if (group !== lastGroup) {
            console.log(`  — ${group}`);
            lastGroup = group;
        }
        const hoist = hoistById.get(id);
        const hoistNote =
            hoist === undefined || role.hoist === hoist ? '' : ` [отображать отдельно: ${hoist ? 'вкл' : 'выкл'}]`;
        console.log(`    ${i + 1}. ${role.name}${hoistNote}`);
    }
    if (unlisted.length) {
        console.warn(`Ролей нет в списке: ${unlisted.length} — поставлены сразу под составом, в прежнем порядке.`);
    }
    if (missing) console.warn(`Не найдено ролей из списка: ${missing}.`);

    const moved = positions.filter(p => guild.roles.cache.get(p.roleId).position !== p.position).length;
    const hoistChanges = [...hoistById].filter(([id, hoist]) => guild.roles.cache.get(id).hoist !== hoist);
    console.log(`Сменят позицию: ${moved}. Сменят "отображать отдельно": ${hoistChanges.length}.`);

    if (!APPLY) {
        console.log('Это предпросмотр. Чтобы применить, запусти с --apply.');
        return;
    }

    if (moved) {
        await guild.roles.setPositions(positions.map(p => ({ role: p.roleId, position: p.position })));
        console.log('Позиции обновлены.');
    }
    for (const [id, hoist] of hoistChanges) {
        const role = guild.roles.cache.get(id);
        await role
            .setHoist(hoist, REASON)
            .catch(err => console.error(`Не удалось изменить "отображать отдельно" у "${role.name}":`, err.message));
    }
    console.log('Готово.');
}

if (require.main === module) {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    client.once('clientReady', async () => {
        try {
            const guild = await client.guilds.fetch(process.env.GUILD_ID);
            await reorderRoles(guild);
            process.exit(process.exitCode ?? 0);
        } catch (err) {
            console.error('Ошибка перестановки ролей:', err);
            process.exit(1);
        }
    });

    client.login(process.env.DISCORD_TOKEN);
}

module.exports = { GROUPS, reorderRoles };
