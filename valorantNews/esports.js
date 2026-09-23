// Киберспорт Valorant в отдельный канал #📬│esports-news: статьи
// категории esports с playvalorant.com, сводка "Матчи сегодня" с пингом
// роли, "Матч начался" и итог матча со счётом. Матчи — из расписания
// HenrikDev (/valorant/v1/esports/schedule, данные официальной лиги):
// статус, команды, победитель и счёт по картам.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');
const news = require('./model');
const config = require('./esportsConfig');

const SCHEDULE_URL = 'https://api.henrikdev.xyz/valorant/v1/esports/schedule';

// Только VCT: региональные лиги VCT, Masters и Champions. Challengers,
// Game Changers и прочие лиги в расписании тоже есть — их не публикуем.
// Разделители _ и - заменяются пробелом, иначе \b не отделил бы "vct" в
// идентификаторах вида vct_americas.
const TRACKED_REGEX = /\b(vct|masters|champions)\b/i;

// Сколько матчей помнить сверх текущего расписания — чтобы список не
// рос бесконечно.
const EXTRA_KEYS_LIMIT = 500;
// Итоги старше суток не публикуем — это уже не новость (например, матч
// появился в расписании задним числом).
const RESULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Страховка от спама, как у ленты новостей: если за одну проверку
// "новых" матчей больше — сбой сверки, ничего не публикуем.
const MAX_MATCH_POSTS_PER_CHECK = 6;
// Сводка "Матчи сегодня" — не раньше 10:00 по Москве.
const DIGEST_TIME_ZONE = 'Europe/Moscow';
const DIGEST_HOUR = 10;

async function fetchSchedule() {
    const res = await fetch(SCHEDULE_URL, { headers: { Authorization: process.env.HENRIKDEV_API_KEY } });
    if (!res.ok) throw new Error(`HenrikDev API (расписание) ответил ${res.status}`);
    const body = await res.json();
    return Array.isArray(body?.data) ? body.data : [];
}

function isTracked(item) {
    const text = [item?.league?.name, item?.league?.identifier, item?.tournament?.name]
        .filter(Boolean)
        .join(' ')
        .replace(/[_-]/g, ' ');
    return TRACKED_REGEX.test(text);
}

// Статус матча в расписании Riot: unstarted / inProgress / completed.
// Сравниваем без учёта регистра и разделителей — на случай in_progress.
function matchState(item) {
    const state = String(item?.state ?? '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');
    if (state === 'completed') return 'completed';
    if (state === 'inprogress' || state === 'live') return 'live';
    return 'upcoming';
}

function matchKey(item) {
    if (item?.match?.id) return String(item.match.id);
    const teams = (item?.match?.teams ?? []).map(t => t.name).join('|');
    return item?.date && teams ? `${item.date}|${teams}` : null;
}

function mergeKeys(currentKeys, previousKeys) {
    const current = [...new Set(currentKeys.filter(Boolean))];
    const currentSet = new Set(current);
    return [...current, ...previousKeys.filter(k => !currentSet.has(k)).slice(0, EXTRA_KEYS_LIMIT)];
}

function dateInZone(ms, timeZone = DIGEST_TIME_ZONE) {
    // en-CA даёт формат YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}

function hourInZone(ms, timeZone = DIGEST_TIME_ZONE) {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(ms));
}

// Что публиковать по матчам на этой проверке. Чистая функция: на входе
// расписание (уже только VCT) и память, на выходе — матчи для "начался",
// для итога, и новая память.
function planMatchPosts(items, liveKeys, resultKeys, now = Date.now()) {
    const liveSeen = new Set(liveKeys);
    const resultSeen = new Set(resultKeys);

    const started = items.filter(i => matchState(i) === 'live' && matchKey(i) && !liveSeen.has(matchKey(i)));
    const finished = items.filter(i => {
        const key = matchKey(i);
        if (matchState(i) !== 'completed' || !key || resultSeen.has(key)) return false;
        const time = new Date(i.date).getTime();
        return Number.isFinite(time) && now - time <= RESULT_MAX_AGE_MS;
    });

    const tooMany = started.length + finished.length > MAX_MATCH_POSTS_PER_CHECK;
    const byDate = (a, b) => new Date(a.date) - new Date(b.date);

    return {
        started: tooMany ? [] : started.sort(byDate),
        finished: tooMany ? [] : finished.sort(byDate),
        tooMany,
        liveKeys: mergeKeys(items.filter(i => matchState(i) !== 'upcoming').map(matchKey), liveKeys),
        resultKeys: mergeKeys(items.filter(i => matchState(i) === 'completed').map(matchKey), resultKeys),
    };
}

// Матчи для сводки "Матчи сегодня" (по Москве), ещё не завершённые.
function todaysMatches(items, now = Date.now()) {
    const today = dateInZone(now);
    return items
        .filter(i => {
            const time = new Date(i.date).getTime();
            return Number.isFinite(time) && dateInZone(time) === today && matchState(i) !== 'completed';
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function teamName(team) {
    return team?.name || 'TBD';
}

function unixSeconds(date) {
    return Math.floor(new Date(date).getTime() / 1000);
}

function bestOf(item) {
    const count = item?.match?.game_type?.count;
    return count ? `Bo${count}` : null;
}

function leagueLine(item, badgeEmoji) {
    const parts = [item?.league?.name, item?.tournament?.name].filter(Boolean);
    return `-# ${badgeEmoji} ${parts.join(' · ') || 'VALORANT Esports'}`;
}

function buildDigestCard(items, pingRoleId, badgeEmoji) {
    const container = baseContainer(COLORS.primary);
    if (pingRoleId) container.addTextDisplayComponents(textDisplay(`<@&${pingRoleId}>`));
    const lines = items.map(i => {
        const [a, b] = i.match?.teams ?? [];
        const extra = [bestOf(i), i.tournament?.name || i.league?.name].filter(Boolean).join(' · ');
        return `<t:${unixSeconds(i.date)}:t> — **${teamName(a)}** vs **${teamName(b)}**${extra ? ` · ${extra}` : ''}`;
    });
    container.addTextDisplayComponents(
        textDisplay(`-# ${badgeEmoji} VALORANT Esports\n### Матчи сегодня\n${lines.join('\n')}`)
    );
    return container;
}

function buildLiveCard(item, badgeEmoji) {
    const [a, b] = item.match?.teams ?? [];
    const format = bestOf(item);
    return baseContainer(COLORS.warning).addTextDisplayComponents(
        textDisplay(
            `${leagueLine(item, badgeEmoji)}\n### Матч начался: ${teamName(a)} vs ${teamName(b)}` +
                (format ? `\n-# ${format}` : '')
        )
    );
}

function buildResultCard(item, badgeEmoji) {
    const [a, b] = item.match?.teams ?? [];
    const winner = [a, b].find(t => t?.has_won);
    const container = baseContainer(COLORS.success).addTextDisplayComponents(
        textDisplay(
            `${leagueLine(item, badgeEmoji)}\n### ${teamName(a)} ${a?.game_wins ?? 0} : ${b?.game_wins ?? 0} ${teamName(b)}` +
                (winner ? `\nПобедитель: **${teamName(winner)}**` : '')
        )
    );
    if (item.vod) {
        container.addSeparatorComponents(separator());
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Запись матча').setURL(item.vod)
            )
        );
    }
    return container;
}

async function resolveChannel(client, channelId) {
    if (!channelId) return null;
    return client.channels.cache.get(channelId) ?? (await client.channels.fetch(channelId).catch(() => null));
}

async function send(channel, container) {
    await channel
        .send(toMessage(container))
        .catch(err => console.error('valorantEsports: не удалось отправить сообщение:', err.message));
}

async function checkArticles(channel, cfg, badgeEmoji) {
    let articles;
    try {
        articles = await news.fetchArticles(news.ESPORTS_CATEGORY);
    } catch (err) {
        console.error('valorantEsports: не удалось получить статьи:', err.message);
        return;
    }
    // Фильтр на своей стороне тоже: если HenrikDev проигнорирует
    // параметр category, в канал киберспорта не уйдут патч-ноуты.
    articles = articles.filter(a => a.category === news.ESPORTS_CATEGORY);

    if (!Array.isArray(cfg.seenArticleUrls)) {
        await config.update(c => {
            c.seenArticleUrls = news.mergeSeenKeys(articles, []);
        });
        return;
    }

    const unseen = news.findUnseenArticles(articles, cfg.seenArticleUrls);
    const { articles: toPost, tooMany } = news.selectArticlesToPost(unseen);
    if (tooMany) console.warn('valorantEsports: слишком много "новых" статей — похоже на сбой сверки, не публикую.');
    for (const article of toPost) {
        await send(channel, news.buildNewsCard(article, cfg.pingRoleId, badgeEmoji));
    }
    if (unseen.length) {
        await config.update(c => {
            c.seenArticleUrls = news.mergeSeenKeys(articles, Array.isArray(c.seenArticleUrls) ? c.seenArticleUrls : []);
        });
    }
}

async function checkMatches(channel, cfg, badgeEmoji, now = Date.now()) {
    let items;
    try {
        items = (await fetchSchedule()).filter(isTracked);
    } catch (err) {
        console.error('valorantEsports: не удалось получить расписание:', err.message);
        return;
    }

    // Первая проверка: всё уже начавшееся и завершённое только
    // запоминается — иначе в канал ушла бы вся история сезона.
    const firstRun = !Array.isArray(cfg.liveMatchKeys) || !Array.isArray(cfg.resultMatchKeys);
    const plan = planMatchPosts(items, cfg.liveMatchKeys ?? [], cfg.resultMatchKeys ?? [], now);

    if (!firstRun) {
        if (plan.tooMany)
            console.warn('valorantEsports: слишком много "новых" матчей — похоже на сбой сверки, не публикую.');
        for (const item of plan.started) await send(channel, buildLiveCard(item, badgeEmoji));
        for (const item of plan.finished) await send(channel, buildResultCard(item, badgeEmoji));
    }

    const today = dateInZone(now);
    let digestPosted = false;
    if (cfg.lastDigestDate !== today && hourInZone(now) >= DIGEST_HOUR) {
        const matches = todaysMatches(items, now);
        if (matches.length) await send(channel, buildDigestCard(matches, cfg.pingRoleId, badgeEmoji));
        digestPosted = true;
    }

    await config.update(c => {
        c.liveMatchKeys = mergeKeys(plan.liveKeys, Array.isArray(c.liveMatchKeys) ? c.liveMatchKeys : []);
        c.resultMatchKeys = mergeKeys(plan.resultKeys, Array.isArray(c.resultMatchKeys) ? c.resultMatchKeys : []);
        if (digestPosted) c.lastDigestDate = today;
    });
}

async function checkAndPostEsports(client) {
    if (!process.env.HENRIKDEV_API_KEY) return;
    const cfg = await config.load();
    const channel = await resolveChannel(client, cfg.channelId);
    if (!channel) return;
    const badgeEmoji = news.resolveBadgeEmoji(channel.guild);
    await checkArticles(channel, cfg, badgeEmoji);
    await checkMatches(channel, cfg, badgeEmoji);
}

module.exports = {
    fetchSchedule,
    isTracked,
    matchState,
    matchKey,
    planMatchPosts,
    todaysMatches,
    dateInZone,
    hourInZone,
    buildDigestCard,
    buildLiveCard,
    buildResultCard,
    checkAndPostEsports,
};
