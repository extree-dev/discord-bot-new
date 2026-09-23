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
    patch_notes: 'Патч-ноуты',
    game_updates: 'Обновление игры',
};
// Лого Valorant, загруженное администратором как кастомный эмодзи
// сервера — вся эта лента и так только про Valorant, поэтому один и тот
// же бренд-эмодзи у обеих категорий вместо разных юникод-иконок
// (🛠️/📰). Резолвится по имени в checkAndPostNews (см. её комментарий),
// как и остальные кастомные эмодзи адаптации — если админ его удалит,
// используется юникод-фолбэк, деплой/публикация из-за этого не падает.
const BADGE_EMOJI_NAME = 'icons8valorant481';
const BADGE_EMOJI_FALLBACK = '🎯';

async function fetchArticles() {
    const res = await fetch(API_URL, {
        headers: { Authorization: process.env.HENRIKDEV_API_KEY },
    });
    if (!res.ok) throw new Error(`HenrikDev API ответил ${res.status}`);
    const body = await res.json();
    return Array.isArray(body?.data) ? body.data : [];
}

// Раньше новизна определялась датой: запоминалась самая поздняя дата в
// ленте, и публиковалось только то, что вышло позже неё. HenrikDev
// отдаёт в ленте и анонсы с датой из будущего (трейлер с датой
// 2026-12-05) — после такой статьи порог уезжал вперёд, и все настоящие
// новости с более ранней датой не публиковались вообще. Теперь помним
// сами статьи (по id, а без него — по url), которые уже видели.
const SEEN_LIMIT = 200;

function articleKey(article) {
    return article?.id || article?.url || null;
}

// Ещё не виденные статьи, от старых к новым — чтобы при публикации сразу
// нескольких пропущенных новостей порядок сообщений в канале совпадал с
// хронологией их выхода.
function findUnseenArticles(articles, seenIds) {
    const seen = new Set(seenIds);
    return articles
        .filter(a => articleKey(a) && !seen.has(articleKey(a)))
        .sort((a, b) => new Date(a.date ?? 0) - new Date(b.date ?? 0));
}

// Статьи текущей ленты плюс ранее виденные, которых в ленте уже нет, —
// чтобы статья, ненадолго выпавшая из ленты, не опубликовалась повторно.
// Ограничено SEEN_LIMIT, чтобы список не рос бесконечно.
function mergeSeenIds(articles, seenIds) {
    const current = articles.map(articleKey).filter(Boolean);
    const currentSet = new Set(current);
    return [...current, ...seenIds.filter(id => !currentSet.has(id))].slice(0, SEEN_LIMIT);
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
//
// Бейдж категории раньше был отдельным TextDisplay-компонентом — из-за
// собственных отступов Discord он смотрелся оторванным огрызком над
// заголовком. Теперь это "-# бейдж" — та же строка markdown, что и у
// заголовка/описания (formatBody), просто внутри ОДНОГО TextDisplay:
// маленькая серая строка-эффектор сразу над жирным заголовком, без
// разрыва между блоками.
function buildNewsCard(article, pingRoleId, badgeEmoji = BADGE_EMOJI_FALLBACK) {
    const container = baseContainer(COLORS.primary);

    if (pingRoleId) {
        container.addTextDisplayComponents(textDisplay(`<@&${pingRoleId}>`));
    }

    const categoryLabel = CATEGORY_LABELS[article.category];
    const body = formatBody(`Valorant: ${article.title}`, article.description || null);
    container.addTextDisplayComponents(
        textDisplay(categoryLabel ? `-# ${badgeEmoji} ${categoryLabel}\n${body}` : body)
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

    // Самый первый прогон (или первый после перехода с lastArticleDate):
    // не публикуем весь бэклог ленты, только запоминаем, что уже в ней есть.
    if (!Array.isArray(cfg.seenArticleIds)) {
        await config.update(c => {
            c.seenArticleIds = mergeSeenIds(articles, []);
            delete c.lastArticleDate;
        });
        return;
    }

    const fresh = findUnseenArticles(articles, cfg.seenArticleIds);
    if (!fresh.length) return;

    if (!cfg.channelId) return;
    const channel =
        client.channels.cache.get(cfg.channelId) ?? (await client.channels.fetch(cfg.channelId).catch(() => null));
    if (!channel) return;

    const pingRole = channel.guild.roles.cache.find(r => r.name === PING_ROLE_NAME);
    const badgeEmojiObj = channel.guild.emojis.cache.find(e => e.name === BADGE_EMOJI_NAME);
    const badgeEmoji = badgeEmojiObj ? badgeEmojiObj.toString() : BADGE_EMOJI_FALLBACK;

    for (const article of fresh) {
        await channel
            .send(toMessage(buildNewsCard(article, pingRole?.id, badgeEmoji)))
            .catch(err => console.error('valorantNews: не удалось отправить статью:', err.message));
    }

    await config.update(c => {
        c.seenArticleIds = mergeSeenIds(articles, Array.isArray(c.seenArticleIds) ? c.seenArticleIds : []);
    });
}

module.exports = {
    fetchArticles,
    findUnseenArticles,
    mergeSeenIds,
    buildNewsCard,
    checkAndPostNews,
};
