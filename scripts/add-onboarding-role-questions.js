require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, GuildOnboardingPromptType } = require('discord.js');
const { findOrCreateRole } = require('../utils/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// В отличие от setup-onboarding.js этот скрипт — часть обычного деплоя
// (см. .github/workflows/deploy.yml) и гоняется на каждый прогон: он
// СИНХРОНИЗИРУЕТ категории из ROLE_CATEGORIES ниже (полностью
// пересобирает их с нуля по текущему коду), не трогая ничего другого —
// вопросы от setup-onboarding.js или добавленные вручную через панель
// администратора остаются как есть (их title не входит в managedTitles
// внутри addRoleQuestions). Значит, эмодзи/описание/состав ролей можно
// свободно менять — просто дописав здесь и передеплоив, дубликатов не
// будет. Заголовки категорий (title) — единственное, что менять не
// стоит: смена title создаст рядом НОВУЮ категорию вместо замены старой
// (сихронизация матчит именно по нему), а старая останется висеть.
// Категорию, которую нужно полностью убрать из визарда (а не просто
// перестать упоминать в ROLE_CATEGORIES), впиши в RETIRED_TITLES ниже —
// иначе синхронизация посчитает её "чужой" и оставит висеть нетронутой
// (роли участников это не трогает, их убирает только вручную админ).
//
// По прямому запросу администратора: почти все каналы сервера закрыты от
// новых участников ролью Unverified до прохождения капчи (см.
// security/verification.js), поэтому вопросы адаптации, "открывающие"
// каналы, малополезны — участник видит их анонсом, но реально попасть
// туда не может до верификации. Вместо этого — чисто декоративные роли
// без единого права (тот же принцип, что у Trusted/Muted: сама роль
// ничего не даёт и не блокирует), которые участник выбирает себе сам как
// вкус/характер, и которые попутно помогают набрать нужный Discord
// минимум (сумма вопросов+вариантов) для включения адаптации, раз
// каналов для этого решили не использовать.
// Discord жёстко ограничивает адаптацию 4 категориями на сервер
// (проверено на практике: editOnboarding с 6 категориями упал с
// prompts[TOO_MANY_ONBOARDING_PROMPTS]) — ROLE_CATEGORIES ниже всегда
// должен содержать не больше 4 записей.
//
// Категории, которые раньше были в ROLE_CATEGORIES и уже создавали
// вопрос на сервере, но теперь убраны из списка выше (например, чтобы
// освободить место под новые под лимит в 4) — перечисли их title здесь,
// иначе синхронизация примет их за "чужие" и оставит висеть нетронутыми.
const RETIRED_TITLES = new Set(['Какой ты новичок?', 'Какой ты искатель приключений?']);

const ROLE_CATEGORIES = [
    {
        title: 'Чем тебе нравится заниматься на сервере?',
        singleSelect: false,
        roles: [
            { name: 'Геймер', color: 0xe74c3c, emoji: '🎮', description: 'Игры — это по мне' },
            { name: 'Творец', color: 0xe67e22, emoji: '🎨', description: 'Рисую, пишу, монтирую — что угодно' },
            { name: 'Болтун', color: 0x3498db, emoji: '💬', description: 'Больше всего люблю общение' },
            { name: 'Меломан', color: 0x1abc9c, emoji: '🎧', description: 'Всегда с музыкой в наушниках' },
        ],
    },
    {
        title: 'Когда ты обычно онлайн?',
        singleSelect: false,
        roles: [
            { name: 'Жаворонок', color: 0xf1c40f, emoji: '🌅', description: 'Утро и день' },
            { name: 'Совунья', color: 0x2c3e50, emoji: '🌙', description: 'Вечер и ночь' },
        ],
    },
    // По прямому запросу администратора сервер ориентирован на игровое
    // сообщество — список подобран под это (мультивыбор, можно отметить
    // сразу несколько игр).
    {
        title: 'На какой игре тебя чаще видно?',
        singleSelect: false,
        roles: [
            { name: 'Valorant', color: 0xff4655, emoji: '🎯', description: 'Тактическая пятёрка на пятёрку' },
            { name: 'CS2', color: 0xf39c12, emoji: '🔫', description: 'Классика тактических шутеров' },
            { name: 'War Thunder', color: 0x34495e, emoji: '✈️', description: 'Танки, самолёты и флот' },
            { name: 'Call of Duty', color: 0x4b5320, emoji: '🪖', description: 'Динамичный шутер, часто онлайн' },
            { name: 'Dota 2', color: 0x6c3483, emoji: '🧙', description: 'MOBA на пять ролей' },
            { name: 'Apex Legends', color: 0xff8c00, emoji: '🪂', description: 'Королевская битва с легендами' },
            { name: 'Minecraft', color: 0x5d8f3d, emoji: '⛏️', description: 'Строю, копаю, выживаю' },
            { name: 'GTA', color: 0xffd700, emoji: '🚗', description: 'Открытый мир и ролплей' },
        ],
    },
    // Пока чисто самоотметка без прав, как и остальные роли здесь —
    // никакого автопинга/выделенного канала под них ещё нет, это
    // отдельная задача (нужны точные названия существующих новостных
    // каналов и решение, как оформить пинг).
    {
        title: 'На какие новости хочешь подписаться?',
        singleSelect: false,
        roles: [
            {
                name: 'Новости сервера',
                color: 0x2980b9,
                emoji: '📰',
                description: 'Объявления и события этого сервера',
            },
            { name: 'Игровые новости', color: 0x16a085, emoji: '🎮', description: 'Патчи, релизы и обновления игр' },
        ],
    },
];

async function addRoleQuestions(guild) {
    const roleIds = {};
    for (const category of ROLE_CATEGORIES) {
        for (const r of category.roles) {
            const { role, created } = await findOrCreateRole({
                guild,
                name: r.name,
                color: r.color,
                // По прямому запросу администратора все кастомные роли
                // адаптации отображаются отдельно от участников онлайн
                // (см. scripts/reorganize-custom-roles.js — там же
                // разово включено это и у уже созданных ранее ролей).
                hoist: true,
                mentionable: false,
                permissions: [],
            });
            console.log(created ? `Создана роль: ${r.name}` : `Роль уже существует: ${r.name}`);
            roleIds[r.name] = role.id;
        }
    }

    const current = await guild.fetchOnboarding();
    const managedTitles = new Set(ROLE_CATEGORIES.map(c => c.title));
    // Вопросы не из этого скрипта (setup-onboarding.js, добавленные
    // вручную через панель) — не трогаем, оставляем как есть. Отдельно
    // отсекаем RETIRED_TITLES — это бывшие "свои" категории, которые
    // нужно удалить из визарда, а не просто прекратить упоминать.
    const untouchedPrompts = [...current.prompts.values()].filter(
        p => !managedTitles.has(p.title) && !RETIRED_TITLES.has(p.title)
    );

    const managedPrompts = ROLE_CATEGORIES.map(category => ({
        title: category.title,
        singleSelect: category.singleSelect,
        required: false,
        inOnboarding: true,
        type: GuildOnboardingPromptType.MultipleChoice,
        options: category.roles.map(r => ({
            title: r.name,
            description: r.description,
            emoji: r.emoji,
            channels: [],
            roles: [roleIds[r.name]],
        })),
    }));

    const payload = {
        prompts: [...untouchedPrompts, ...managedPrompts],
        defaultChannels: [...current.defaultChannels.values()],
        mode: current.mode,
        reason: 'Синхронизация вопросов адаптации с косметическими ролями',
    };

    try {
        const updated = await guild.editOnboarding({ ...payload, enabled: true });
        console.log(
            `Готово: синхронизировано ${managedPrompts.length} вопрос(ов) с ролями, адаптация включена. Всего вопросов: ${updated.prompts.size}.`
        );
    } catch (err) {
        console.warn(`Не удалось включить адаптацию (${err.message}) — сохраняю вопросы выключенными.`);
        const updated = await guild.editOnboarding({ ...payload, enabled: false });
        console.log(
            `Синхронизировано ${managedPrompts.length} вопрос(ов) с ролями, но адаптация всё ещё выключена (не хватает вопросов/каналов для порога Discord). Всего вопросов: ${updated.prompts.size}.`
        );
    }
}

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await addRoleQuestions(guild);
        process.exit(0);
    } catch (err) {
        console.error('Ошибка добавления вопросов адаптации:', err.message);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
