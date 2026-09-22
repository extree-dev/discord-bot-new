require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, GuildOnboardingPromptType } = require('discord.js');
const { findOrCreateRole } = require('../utils/idempotent');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// В отличие от setup-onboarding.js этот скрипт — часть обычного деплоя
// (см. .github/workflows/deploy.yml) и гоняется на каждый прогон: он
// добавляет только те категории из ROLE_CATEGORIES ниже, которых ещё
// нет среди текущих вопросов (дедуп по title), так что повторный запуск
// без изменений в списке ничего не делает. Новую категорию — просто
// дописать в массив, следующий деплой подхватит её сам.
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
const ROLE_CATEGORIES = [
    {
        title: 'Чем тебе нравится заниматься на сервере?',
        singleSelect: false,
        roles: [
            { name: 'Геймер', color: 0xe74c3c, description: null },
            { name: 'Творец', color: 0xe67e22, description: null },
            { name: 'Болтун', color: 0x3498db, description: null },
            { name: 'Меломан', color: 0x1abc9c, description: null },
        ],
    },
    {
        title: 'Когда ты обычно онлайн?',
        singleSelect: false,
        roles: [
            { name: 'Жаворонок', color: 0xf1c40f, description: 'Утро и день' },
            { name: 'Совунья', color: 0x2c3e50, description: 'Вечер и ночь' },
        ],
    },
    {
        title: 'Какой ты новичок?',
        singleSelect: true,
        roles: [
            { name: 'Активный', color: 0x2ecc71, description: null },
            { name: 'Тихий наблюдатель', color: 0x95a5a6, description: null },
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
                hoist: false,
                mentionable: false,
                permissions: [],
            });
            console.log(created ? `Создана роль: ${r.name}` : `Роль уже существует: ${r.name}`);
            roleIds[r.name] = role.id;
        }
    }

    const current = await guild.fetchOnboarding();
    const existingTitles = new Set([...current.prompts.values()].map(p => p.title));

    const newPrompts = ROLE_CATEGORIES.filter(category => !existingTitles.has(category.title)).map(category => ({
        title: category.title,
        singleSelect: category.singleSelect,
        required: false,
        inOnboarding: true,
        type: GuildOnboardingPromptType.MultipleChoice,
        options: category.roles.map(r => ({
            title: r.name,
            description: r.description,
            channels: [],
            roles: [roleIds[r.name]],
        })),
    }));

    if (newPrompts.length === 0) {
        console.log('Добавление вопросов адаптации: все вопросы-категории уже есть — ничего не делаю.');
        return;
    }

    const payload = {
        prompts: [...current.prompts.values(), ...newPrompts],
        defaultChannels: [...current.defaultChannels.values()],
        mode: current.mode,
        reason: 'Массовое добавление вопросов адаптации с косметическими ролями',
    };

    try {
        const updated = await guild.editOnboarding({ ...payload, enabled: true });
        console.log(
            `Готово: добавлено ${newPrompts.length} вопрос(ов), адаптация включена. Всего вопросов: ${updated.prompts.size}.`
        );
    } catch (err) {
        console.warn(`Не удалось включить адаптацию (${err.message}) — сохраняю вопросы выключенными.`);
        const updated = await guild.editOnboarding({ ...payload, enabled: false });
        console.log(
            `Добавлено ${newPrompts.length} вопрос(ов), но адаптация всё ещё выключена (не хватает вопросов/каналов для порога Discord). Всего вопросов: ${updated.prompts.size}. Можно добавить ещё через панель администратора или запустить скрипт снова с новой категорией.`
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
