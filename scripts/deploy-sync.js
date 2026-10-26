require('dotenv').config({ quiet: true });
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');

// Раньше .github/workflows/deploy.yml запускал deploy-commands.js и 17
// scripts/setup-*.js по отдельности — docker compose run --rm bot node
// X.js на каждый, то есть 18 отдельных контейнеров и 17 отдельных
// gateway-логинов (client.login()) подряд. Сам логин — это полный
// Discord-хендшейк (обычно несколько секунд), и на 17 скриптах подряд
// это съедало большую часть времени деплоя. Все scripts/setup-*.js
// используют один и тот же intents-набор ([GatewayIntentBits.Guilds]) и
// после рефакторинга экспортируют run(client) вместо того, чтобы сами
// логиниться — здесь один клиент логинится один раз, и все шаги
// выполняются внутри одного процесса в том же порядке, что раньше был в
// deploy.yml (комментарии там про важность порядка — например,
// setup-memo.js после остальных фич — по-прежнему в силе).
//
// Каждый scripts/setup-X.js остаётся полностью рабочим и как отдельный
// файл (node scripts/setup-X.js [--bootstrap]) — для него ничего не
// изменилось, этот скрипт просто переиспользует тот же run(client).
const STEPS = [
    { name: 'scripts/setup-roles.js', run: require('./setup-roles') },
    { name: 'scripts/setup-verification.js', run: require('./setup-verification') },
    { name: 'scripts/setup-tickets.js', run: require('./setup-tickets') },
    { name: 'scripts/setup-ticket-management.js', run: require('./setup-ticket-management') },
    { name: 'scripts/setup-punishment-notices.js', run: require('./setup-punishment-notices') },
    { name: 'scripts/setup-temp-voice.js', run: require('./setup-temp-voice') },
    { name: 'scripts/setup-suggestions.js', run: require('./setup-suggestions') },
    { name: 'scripts/setup-rules.js', run: require('./setup-rules') },
    { name: 'scripts/setup-changelog.js', run: require('./setup-changelog') },
    { name: 'scripts/setup-leveling.js', run: require('./setup-leveling') },
    { name: 'scripts/setup-modqueue.js', run: require('./setup-modqueue') },
    { name: 'scripts/setup-idea-queue.js', run: require('./setup-idea-queue') },
    // После rules/changelog/leveling/tickets/suggestions/voice/idea-queue —
    // памятка ссылается на каналы всех этих фич по сохранённому ID
    // (memo/index.js gatherChannelIds), порядок здесь важен.
    { name: 'scripts/setup-memo.js', run: require('./setup-memo') },
    { name: 'scripts/setup-admin-panel.js', run: require('./setup-admin-panel') },
    // scripts/setup-onboarding.js и scripts/add-onboarding-role-questions.js
    // в деплой не входят (см. .github/workflows/deploy.yml) — адаптация
    // Discord редактируется только целиком, прогон на каждом деплое
    // затирал бы ручные правки. Запускать вручную, когда нужно.
    // Канал #📬│game-news задан константой в самом скрипте, от
    // setup-changelog.js не зависит — порядок здесь не важен.
    { name: 'scripts/setup-valorant-news.js', run: require('./setup-valorant-news') },
    { name: 'scripts/setup-esports-news.js', run: require('./setup-esports-news') },
    { name: 'scripts/setup-game-news.js', run: require('./setup-game-news') },
];

// utils/setupMode.js подсказывает конкретную команду для ручного
// --bootstrap по process.argv[1] (bootstrapHint()) — без этой подмены все
// подсказки во время синхронизации указывали бы на сам этот оркестратор,
// а не на реальный скрипт конкретной фичи.
async function runStep(name, scriptPath, run, ...args) {
    console.log(`\n--- ${name} ---`);
    const prevArgv1 = process.argv[1];
    process.argv[1] = scriptPath;
    try {
        const ok = await run(...args);
        if (ok === false) {
            console.log(`::warning::${name} завершился с ошибкой, смотри лог выше`);
            return false;
        }
        return true;
    } catch (err) {
        console.error(`Необработанная ошибка в ${name}:`, err);
        console.log(`::warning::${name} завершился с ошибкой, смотри лог выше`);
        return false;
    } finally {
        process.argv[1] = prevArgv1;
    }
}

async function main() {
    let failed = false;

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    const ready = new Promise(resolve => client.once('clientReady', resolve));
    const loginPromise = client.login(process.env.DISCORD_TOKEN);

    // REST-only шаг — не ждёт gateway-логин, выполняется, пока клиент
    // подключается в фоне.
    const deployCommandsPath = path.join(__dirname, '..', 'deploy-commands.js');
    if (!(await runStep('deploy-commands.js', deployCommandsPath, require('../deploy-commands')))) {
        failed = true;
    }

    await loginPromise;
    await ready;

    for (const step of STEPS) {
        const scriptPath = path.join(__dirname, path.basename(step.name));
        if (!(await runStep(step.name, scriptPath, step.run, client))) {
            failed = true;
        }
    }

    client.destroy();
    process.exit(failed ? 1 : 0);
}

main();
