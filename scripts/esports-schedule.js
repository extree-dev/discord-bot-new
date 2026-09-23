require('dotenv').config({ quiet: true });
const valorantNews = require('../valorantNews');

// Диагностика расписания киберспорта (ничего не публикует, в Discord не
// заходит): какие лиги есть в расписании HenrikDev, какие из них бот
// отслеживает (VCT / Masters / Champions) и ближайшие матчи.
//   docker compose run --rm bot node scripts/esports-schedule.js
(async () => {
    if (!process.env.HENRIKDEV_API_KEY) {
        console.error('HENRIKDEV_API_KEY не задан в .env.');
        process.exit(1);
    }
    try {
        const items = await valorantNews.fetchEsportsSchedule();
        console.log(`Матчей в расписании: ${items.length}`);

        const leagues = new Map();
        for (const item of items) {
            const key = `${item.league?.name} (${item.league?.identifier}, ${item.league?.region})`;
            const entry = leagues.get(key) ?? { count: 0, tracked: valorantNews.isTrackedEsportsMatch(item) };
            entry.count++;
            leagues.set(key, entry);
        }
        console.log('Лиги (✔ — публикуются ботом):');
        for (const [name, { count, tracked }] of leagues) console.log(`  ${tracked ? '✔' : ' '} ${name}: ${count}`);

        const now = Date.now();
        const upcoming = items
            .filter(i => valorantNews.isTrackedEsportsMatch(i) && new Date(i.date).getTime() >= now - 6 * 3600 * 1000)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 15);
        console.log('Ближайшие отслеживаемые матчи:');
        for (const i of upcoming) {
            const [a, b] = i.match?.teams ?? [];
            console.log(
                `  ${i.date} | ${i.state} | ${a?.name ?? 'TBD'} ${a?.game_wins ?? ''}:${b?.game_wins ?? ''} ${b?.name ?? 'TBD'} | ${i.tournament?.name}`
            );
        }
        process.exit(0);
    } catch (err) {
        console.error('Ошибка:', err.message);
        process.exit(1);
    }
})();
