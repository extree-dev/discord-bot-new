require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, GuildOnboardingMode, GuildOnboardingPromptType } = require('discord.js');
const rules = require('../rules');
const changelog = require('../changelog');
const leveling = require('../leveling');
const security = require('../security');
const tickets = require('../tickets');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Первоначальная настройка "Адаптации" (Discord Onboarding) — работает
// ровно один раз: если у гильдии уже есть хоть один вопрос или адаптация
// уже включена (администратор настроил её вручную через Discord либо
// через панель администратора — adminPanel/onboarding.js), скрипт сразу
// выходит и больше никогда не трогает конфигурацию. Это НЕ идемпотентный
// sync (как остальные setup-*.js для каналов/ролей) — Discord Onboarding
// редактируется только целиком (PUT, не PATCH), поэтому повторный запуск
// с нашими дефолтами на каждый деплой стёр бы всё, что администратор
// добавил или убрал через панель.
async function setupOnboarding(guild) {
    const current = await guild.fetchOnboarding().catch(() => null);
    if (current && (current.enabled || current.prompts.size > 0)) {
        console.log(
            'Адаптация уже настроена (или отключена вручную) — не трогаю, дальше правится через панель администратора.'
        );
        return;
    }

    const [rulesLoc, changelogCfg, levelingCfg, securityCfg, ticketsCfg] = await Promise.all([
        rules.getPostedLocation(),
        changelog.getConfig(),
        leveling.getGuildConfig(guild.id),
        security.getConfig(),
        tickets.getConfig(),
    ]);

    const resolve = id => (id ? guild.channels.cache.get(id) : null);
    const channels = {
        rules: resolve(rulesLoc.channelId),
        verification: resolve(securityCfg.verification.channelId),
        changelog: resolve(changelogCfg.channelId),
        leaderboard: resolve(levelingCfg.announceChannelId),
        openTicket: resolve(ticketsCfg.panelChannelId),
    };

    const missing = Object.entries(channels)
        .filter(([, ch]) => !ch)
        .map(([key]) => key);
    if (missing.length) {
        console.warn(`Адаптация: часть ожидаемых каналов ещё не настроена (${missing.join(', ')}) — пропущу их.`);
    }

    const defaultChannels = Object.values(channels).filter(Boolean);
    if (defaultChannels.length === 0) {
        console.warn(
            'Адаптация: ни один из ожидаемых каналов ещё не настроен — пропускаю, попробую на следующем деплое.'
        );
        return;
    }

    const option = (title, description, channel) => ({
        title,
        description,
        channels: channel ? [channel] : [],
        roles: [],
    });

    const prompts = [];

    const primaryOptions = [
        channels.rules && option('Правила сервера', 'Обязательно прочитай перед тем как начать', channels.rules),
        channels.verification &&
            option('Как пройти верификацию', 'Без этого закрыты почти все каналы сервера', channels.verification),
        channels.changelog && option('Что нового в этой версии', null, channels.changelog),
        channels.leaderboard && option('Топ активности участников', null, channels.leaderboard),
    ].filter(Boolean);
    if (primaryOptions.length) {
        prompts.push({
            title: 'С чего начать',
            singleSelect: false,
            required: true,
            inOnboarding: true,
            type: GuildOnboardingPromptType.MultipleChoice,
            options: primaryOptions,
        });
    }

    if (channels.openTicket) {
        prompts.push({
            title: 'Нужна помощь?',
            singleSelect: true,
            required: false,
            inOnboarding: true,
            type: GuildOnboardingPromptType.MultipleChoice,
            options: [
                option('Пожаловаться на игрока', 'Откроет тикет для модерации', channels.openTicket),
                option('Пока просто осматриваюсь', null, null),
            ],
        });
    }

    if (prompts.length === 0) {
        console.warn('Адаптация: не набралось ни одного вопроса из доступных каналов — пропускаю.');
        return;
    }

    const payload = {
        prompts,
        defaultChannels,
        mode: GuildOnboardingMode.OnboardingAdvanced,
        reason: 'Первоначальная настройка адаптации ботом',
    };

    // Discord требует минимум публичных каналов/вопросов, чтобы включить
    // адаптацию по-настоящему (enabled: true) — на новом/маленьком
    // сервере этого порога может не хватать. Если включить не вышло,
    // сохраняем вопросы и каналы всё равно (enabled: false) — они видны
    // и редактируемы в "Каналы и роли"/через панель администратора, и
    // включить можно будет сразу, как наберётся достаточно каналов.
    try {
        await guild.editOnboarding({ ...payload, enabled: true });
        console.log(
            `Адаптация настроена и включена: ${prompts.length} вопрос(ов), ${defaultChannels.length} канал(ов) по умолчанию.`
        );
    } catch (err) {
        console.warn(`Не удалось включить адаптацию (${err.message}) — сохраняю вопросы выключенными.`);
        await guild.editOnboarding({ ...payload, enabled: false });
        console.log(
            `Адаптация сохранена, но выключена: ${prompts.length} вопрос(ов), ${defaultChannels.length} канал(ов). Включить можно через панель администратора, когда наберётся достаточно публичных каналов.`
        );
    }
}

client.once('clientReady', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();
        await setupOnboarding(guild);
        console.log('Готово.');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка настройки адаптации:', err.message);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
