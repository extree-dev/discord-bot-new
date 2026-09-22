// Доменный слой новостей Valorant: забирает статьи с официальной
// страницы playvalorant.com/news через неофициальный, но широко
// используемый HenrikDev API (у самого Riot нет ни RSS, ни новостного
// эндпоинта в официальном Developer API — проверено), и публикует
// только по-настоящему новые в канал #📰│новости-сервера.
const { COLORS, formatBody } = require('../utils/embeds');
const { baseContainer, textDisplay, toMessage } = require('../utils/components');
const config = require('./config');

const API_URL = 'https://api.henrikdev.xyz/valorant/v1/website/en-us';
// Роль заведена вопросом адаптации (scripts/add-onboarding-role-
// questions.js), ID нигде не персистится — резолвится по имени в момент
// публикации, как и остальные косметические роли той же категории.
const PING_ROLE_NAME = 'Игровые новости';

async function fetchArticles() {
    const res = await fetch(API_URL, {
        headers: { Authorization: process.env.HENRIKDEV_API_KEY },
    });
    if (!res.ok) throw new Error(`HenrikDev API ответил ${res.status}`);
    const body = await res.json();
    return Array.isArray(body?.data) ? body.data : [];
}

// Только статьи строже новее sinceIso, от старых к новым — чтобы при
// публикации сразу нескольких пропущенных новостей порядок сообщений в
// канале совпадал с хронологией их выхода. sinceIso === null (самый
// первый прогон, см. checkAndPostNews) означает "ничего ещё не видели" —
// формально тогда все статьи "новые", но checkAndPostNews такой список
// не публикует, а только использует latestArticleDate() для затравки.
function findNewArticles(articles, sinceIso) {
    const since = sinceIso ? new Date(sinceIso).getTime() : null;
    return articles
        .filter(a => a?.date && (since === null || new Date(a.date).getTime() > since))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function latestArticleDate(articles) {
    return articles.reduce((max, a) => {
        if (!a?.date) return max;
        return !max || new Date(a.date) > new Date(max) ? a.date : max;
    }, null);
}

function buildNewsCard(article) {
    const container = baseContainer(COLORS.primary).addTextDisplayComponents(
        textDisplay(formatBody(`Valorant: ${article.title}`, article.description || null))
    );
    container.addTextDisplayComponents(textDisplay(`[Подробнее](${article.url})`));
    return container;
}

async function checkAndPostNews(client) {
    // Без ключа фича молча простаивает — ключ не входит в код (см.
    // .env.example), это осознанный пропуск, а не забытая настройка.
    if (!process.env.HENRIKDEV_API_KEY) return;

    let articles;
    try {
        articles = await fetchArticles();
    } catch (err) {
        console.error('valorantNews: не удалось получить новости:', err.message);
        return;
    }
    if (!articles.length) return;

    const cfg = await config.load();

    if (!cfg.lastArticleDate) {
        await config.update(c => {
            c.lastArticleDate = latestArticleDate(articles);
        });
        return;
    }

    const fresh = findNewArticles(articles, cfg.lastArticleDate);
    if (!fresh.length) return;

    if (!cfg.channelId) return;
    const channel =
        client.channels.cache.get(cfg.channelId) ?? (await client.channels.fetch(cfg.channelId).catch(() => null));
    if (!channel) return;

    const pingRole = channel.guild.roles.cache.find(r => r.name === PING_ROLE_NAME);

    for (const article of fresh) {
        // Components V2 (toMessage()) не может нести content вместе с
        // компонентами (см. комментарий в utils/components.js) — пинг
        // роли поэтому отдельным обычным сообщением перед карточкой, а
        // не полем content на том же payload.
        if (pingRole) {
            await channel.send({ content: `<@&${pingRole.id}>` }).catch(() => {});
        }
        await channel
            .send(toMessage(buildNewsCard(article)))
            .catch(err => console.error('valorantNews: не удалось отправить статью:', err.message));
    }

    await config.update(c => {
        c.lastArticleDate = latestArticleDate(articles);
    });
}

module.exports = {
    fetchArticles,
    findNewArticles,
    latestArticleDate,
    buildNewsCard,
    checkAndPostNews,
};
