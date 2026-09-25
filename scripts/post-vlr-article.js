require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits } = require('discord.js');
const news = require('../valorantNews/model');
const esports = require('../valorantNews/esports');
const esportsConfig = require('../valorantNews/esportsConfig');
const { toMessage } = require('../utils/components');

// Разовый ручной инструмент (не входит в деплой, не гоняется
// scripts/setup-*.js) — публикует В КАНАЛ КИБЕРСПОРТА одну конкретную
// статью VLR.gg по ссылке, минуя обычную сверку "уже видели/не видели"
// (valorantNews/esports.js checkVlrNews). Нужен, чтобы вручную проверить
// карточку (в частности картинку, см. fetchVlrArticleImage) на реальной
// статье прямо на сервере, не дожидаясь новой новости в ленте.
//
// Запуск: docker compose run --rm bot node scripts/post-vlr-article.js <ссылка на статью VLR.gg>
const VLR_HEADERS = { 'User-Agent': 'ExtreeBot (Discord bot; VLR.gg reader)' };

function parseOgTitle(html) {
    const match = html.match(/<meta property="og:title" content="([^"]*)"/);
    if (!match) return null;
    // VLR.gg дописывает " | VLR.gg" в конец og:title — в самой статье
    // этого суффикса нет, и он не нужен в заголовке карточки.
    return match[1].replace(/\s*\|\s*VLR\.gg$/, '');
}

function parseOgDescription(html) {
    const match = html.match(/<meta property="og:description" content="([^"]*)"/);
    return match ? match[1] : null;
}

async function fetchArticle(url) {
    const res = await fetch(url, { headers: VLR_HEADERS });
    if (!res.ok) throw new Error(`VLR.gg ${url} ответил ${res.status}`);
    const html = await res.text();
    const title = parseOgTitle(html);
    if (!title) throw new Error('Не удалось найти og:title — похоже, это не страница статьи VLR.gg.');
    return {
        title,
        url,
        description: parseOgDescription(html),
        category: 'vlr',
    };
}

async function main() {
    const url = process.argv[2];
    if (!url) throw new Error('Укажи ссылку на статью VLR.gg аргументом: node scripts/post-vlr-article.js <url>');

    const article = await fetchArticle(url);
    article.banner_url = await esports.fetchVlrArticleImage(url);

    const cfg = await esportsConfig.load();
    if (!cfg.channelId) throw new Error('Канал киберспорта ещё не настроен (см. scripts/setup-esports-news.js).');

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    client.once('clientReady', async () => {
        try {
            const channel = await client.channels.fetch(cfg.channelId);
            const badgeEmoji = news.resolveBadgeEmoji(channel.guild);
            const container = news.buildNewsCard(article, cfg.pingRoleId, badgeEmoji);
            await channel.send(toMessage(container));
            console.log(
                `Опубликовано в #${channel.name}: "${article.title}" (картинка: ${article.banner_url ?? 'нет'}).`
            );
            process.exit(0);
        } catch (err) {
            console.error('Ошибка публикации:', err);
            process.exit(1);
        }
    });
    await client.login(process.env.DISCORD_TOKEN);
}

main().catch(err => {
    console.error('Ошибка:', err);
    process.exit(1);
});
