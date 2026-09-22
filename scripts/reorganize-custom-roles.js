require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits } = require('discord.js');
const leveling = require('../leveling');
const { pickOldest } = require('../utils/idempotent');
const { computeReorganizedPositions } = require('../utils/roleHierarchy');

// Разовая перестройка иерархии/отображения кастомных ролей по прямому
// запросу администратора. Не входит в деплой (см. .github/workflows/
// deploy.yml) — как fix-role-hierarchy.js и fix-duplicates.js, это
// ручное действие, а не провижининг, который должен повторяться на
// каждый деплой (иначе бот молча перебивал бы любую последующую ручную
// перестановку администратора). Запускать вручную:
// docker compose run --rm bot node scripts/reorganize-custom-roles.js

// Ярусы активности (leveling/model.js LEVELS) — от старшего к младшему,
// чтобы более высокий ярус был выше в списке ролей.
const LEVEL_TIER_NAMES = leveling.LEVELS.map(l => l.title).reverse();

// Косметические роли адаптации (см. scripts/add-onboarding-role-
// questions.js) — включая Активный/Тихий наблюдатель/Воин/Страж/
// Стрелок/Маг, чьи вопросы убрали из визарда (PR #134), но сами роли
// остались на сервере у тех, кто их уже получил.
const COSMETIC_ROLE_NAMES = [
    'Геймер',
    'Творец',
    'Болтун',
    'Меломан',
    'Жаворонок',
    'Совунья',
    'Активный',
    'Тихий наблюдатель',
    'Воин',
    'Страж',
    'Стрелок',
    'Маг',
    'Valorant',
    'CS2',
    'War Thunder',
    'Call of Duty',
    'Dota 2',
    'Apex Legends',
    'Minecraft',
    'GTA',
    'Новости сервера',
    'Игровые новости',
];

// По прямому запросу администратора: весь блок выше — единым куском
// прямо под ANCHOR_NAME, с включённым "отображение отдельно" (hoist).
const MANAGED_BLOCK_NAMES = [...LEVEL_TIER_NAMES, ...COSMETIC_ROLE_NAMES];
const ANCHOR_NAME = 'Moderator';
const BOTTOM_NAMES = ['Trusted', 'Muted'];
const HOIST_OFF_NAMES = ['Verified'];

function findRoleByName(guild, name) {
    const matches = [...guild.roles.cache.filter(r => r.name === name).values()];
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    const canonical = pickOldest(matches);
    console.warn(
        `Найдено ${matches.length} ролей с именем "${name}" — использую самую старую (${canonical.id}). ` +
            `Лишние: ${matches
                .filter(m => m.id !== canonical.id)
                .map(m => m.id)
                .join(', ')}`
    );
    return canonical;
}

function resolveIds(guild, names) {
    const ids = [];
    for (const name of names) {
        const role = findRoleByName(guild, name);
        if (role) ids.push(role.id);
        else console.warn(`Роль "${name}" не найдена — пропускаю (не создаю заново).`);
    }
    return ids;
}

async function reorganizeRoles(guild) {
    await guild.roles.fetch();

    const anchor = findRoleByName(guild, ANCHOR_NAME);
    if (!anchor) {
        console.error(
            `Роль-ориентир "${ANCHOR_NAME}" не найдена — прерываю, ничего не меняю. ` +
                `Текущие роли на сервере: ${[...guild.roles.cache.values()].map(r => r.name).join(', ')}`
        );
        process.exitCode = 1;
        return;
    }

    const me = await guild.members.fetchMe();
    const botPosition = me.roles.highest.position;
    if (anchor.position >= botPosition) {
        console.error(
            `Роль "${ANCHOR_NAME}" (позиция ${anchor.position}) на уровне роли бота или выше ` +
                `(позиция бота ${botPosition}) — не могу ей управлять, прерываю.`
        );
        process.exitCode = 1;
        return;
    }

    const managedOrderIds = resolveIds(guild, MANAGED_BLOCK_NAMES);
    const bottomOrderIds = resolveIds(guild, BOTTOM_NAMES);

    const roles = [...guild.roles.cache.values()].map(r => ({
        id: r.id,
        position: r.position,
        managed: r.managed,
    }));

    const updates = computeReorganizedPositions({
        roles,
        anchorId: anchor.id,
        managedOrderIds,
        bottomOrderIds,
        everyoneId: guild.roles.everyone.id,
    });

    if (updates.length) {
        await guild.roles.setPositions(updates.map(u => ({ role: u.roleId, position: u.position })));
        console.log(`Позиции обновлены у ${updates.length} ролей.`);
    } else {
        console.log('Позиции ролей уже верные — без изменений.');
    }

    let hoisted = 0;
    for (const id of managedOrderIds) {
        const role = guild.roles.cache.get(id);
        if (role && !role.hoist) {
            await role
                .setHoist(true, 'Перестройка ролей по запросу администратора')
                .then(() => hoisted++)
                .catch(err => console.error(`Не удалось включить отображение отдельно у "${role.name}":`, err.message));
        }
    }
    console.log(`Отображение отдельно включено у ${hoisted} ролей (у остальных уже было включено).`);

    for (const name of HOIST_OFF_NAMES) {
        const role = findRoleByName(guild, name);
        if (!role) {
            console.warn(`Роль "${name}" не найдена — не могу выключить отображение отдельно.`);
            continue;
        }
        if (role.hoist) {
            await role
                .setHoist(false, 'Выключение отображения отдельно по запросу администратора')
                .then(() => console.log(`Отображение отдельно выключено у "${role.name}".`))
                .catch(err =>
                    console.error(`Не удалось выключить отображение отдельно у "${role.name}":`, err.message)
                );
        } else {
            console.log(`У "${role.name}" отображение отдельно уже выключено.`);
        }
    }

    console.log('Готово.');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await reorganizeRoles(guild);
        process.exit(process.exitCode ?? 0);
    } catch (err) {
        console.error('Ошибка перестройки ролей:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
