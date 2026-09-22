// Доменный слой новостей Valorant: забирает статьи с официальной
// страницы playvalorant.com/news через неофициальный, но широко
// используемый HenrikDev API (у самого Riot нет ни RSS, ни новостного
// эндпоинта в официальном Developer API — проверено), и публикует
// только по-настоящему новые в канал #📬│game-news.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MediaGalleryBuilder } = require('discord.js');
const { COLORS, formatBody } = require('../utils/embeds');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');
const config = require('./config');

const API_URL = 'https://api.henrikdev.xyz/valorant/v1/website/en-us';
// Роль заведена вопросом адаптации (scripts/add-onboarding-role-
// questions.js), ID нигде не персистится — резолвится по имени в момент
// публикации, как и остальные косметические роли той же категории.
const PING_ROLE_NAME = 'Игровые новости';
// Единственные два значения category, реально встреченные в ответе
// HenrikDev API (проверено живым запросом) — остальные (если появятся)
// просто не покажут бейдж категории, а не сырой английский slug.
const CATEGORY_LABELS = {
    patch_notes: '🛠️ Патч-ноуты',
    game_updates: '📰 Обновление игры',
};

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

// pingRoleId — необязательный: упоминание роли рисуется отдельной
// TextDisplay-строкой прямо над заголовком. Discord парсит и пингует
// упоминания внутри TextDisplay точно так же, как в обычном content
// (подтверждено официальной документацией компонентов), поэтому не
// нужно отдельное сообщение с content — раньше было именно так, но
// Components V2 запрещает content на этом же сообщении (см.
// utils/components.js), а не упоминания внутри самих компонентов.
//
// banner_url у HenrikDev есть в каждой статье, но раньше никак не
// использовался — карточка была чисто текстовой. MediaGallery рисует
// картинку на всю ширину, а "Подробнее" теперь настоящая кнопка-ссылка
// (ButtonStyle.Link, без customId — Discord открывает URL сам, ничего
// не долетает до бота), а не текст со ссылкой внутри TextDisplay.
function buildNewsCard(article, pingRoleId) {
    const container = baseContainer(COLORS.primary);

    if (pingRoleId) {
        container.addTextDisplayComponents(textDisplay(`<@&${pingRoleId}>`));
    }

    const categoryLabel = CATEGORY_LABELS[article.category];
    if (categoryLabel) {
        container.addTextDisplayComponents(textDisplay(categoryLabel));
    }

    container.addTextDisplayComponents(
        textDisplay(formatBody(`Valorant: ${article.title}`, article.description || null))
    );

    if (article.banner_url) {
        container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems({ media: { url: article.banner_url } }));
    }

    container.addSeparatorComponents(separator());
    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Подробнее').setURL(article.url)
        )
    );

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
        await channel
            .send(toMessage(buildNewsCard(article, pingRole?.id)))
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
