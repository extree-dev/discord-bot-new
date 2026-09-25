// Киберспорт Valorant в отдельный канал #📬│esports-news: все новости
// киберсцены с VLR.gg (трансферы, турниры, интервью — RSS, с пингом),
// официальные анонсы Riot (статьи категории esports с playvalorant.com,
// с пингом роли), сводка "Матчи сегодня" с пингом, "Матч начался" и итог
// матча со счётом. Матчи — со страниц VLR.gg /matches (расписание и
// лайв) и /matches/results (итоги): расписание HenrikDev
// (/valorant/v1/esports/schedule) отвечало 500 перед самым стартом
// Champions 2026, а VLR.gg — первоисточник этих данных у самого HenrikDev.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS } = require('../utils/embeds');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');
const news = require('./model');
const config = require('./esportsConfig');

const VLR_BASE_URL = 'https://www.vlr.gg';
const VLR_MATCHES_URL = `${VLR_BASE_URL}/matches`;
const VLR_RESULTS_URL = `${VLR_BASE_URL}/matches/results`;
const VLR_HEADERS = { 'User-Agent': 'ExtreeBot (Discord bot; VLR.gg reader)' };
// VLR.gg показывает время в поясе того, кто открывает сайт (по IP): с
// сервера в США — CDT, с сервера в Европе — CEST. Поэтому точное
// смещение берётся из обратного отсчёта "через 14h 19m" у ближайших
// матчей на /matches (и переиспользуется для /matches/results, где
// отсчёта нет), а этот пояс — только запасной вариант.
const VLR_FALLBACK_TIME_ZONE = 'America/Chicago';
// Главный сайт новостей киберсцены Valorant. RSS — 20 последних
// новостей: заголовок, ссылка, дата, короткое описание (без картинок,
// см. fetchVlrArticleImage — картинку приходится отдельно забирать со
// страницы самой статьи).
const VLR_RSS_URL = 'https://www.vlr.gg/rss';
// og:image, который VLR.gg отдаёт у статей без собственной фотографии
// (трансферные новости и т.п.) — общий логотип сайта, один и тот же на
// всех таких статьях (проверено вручную по нескольким новостям текущей
// ленты). У статей с настоящим скрином/фото og:image ведёт на их CDN
// (owcdn.net/img/...) — такой адрес постим, этот — не считаем картинкой.
const VLR_GENERIC_IMAGE = 'https://www.vlr.gg/img/vlr/card.png';

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

const MONTHS = {
    January: 0,
    February: 1,
    March: 2,
    April: 3,
    May: 4,
    June: 5,
    July: 6,
    August: 7,
    September: 8,
    October: 9,
    November: 10,
    December: 11,
};

function stripTags(html) {
    return decodeXml(html.replace(/<[^>]*>/g, ' '))
        .replace(/&ndash;/g, '–')
        .replace(/\s+/g, ' ')
        .trim();
}

// Смещение пояса (мс) в момент utcMs: сколько местное время опережает UTC.
function zoneOffsetMs(utcMs, timeZone) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
            .formatToParts(utcMs)
            .map(p => [p.type, p.value])
    );
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// "14h 19m" / "1d 3h" / "45m" → мс; точным считаем только отсчёт с
// минутами (меньше суток) — по нему и вычисляется пояс страницы.
function parseEta(text) {
    const match = String(text ?? '').match(/^(?:(\d+)h\s*)?(\d+)m$/);
    if (!match) return null;
    return (Number(match[1] ?? 0) * 60 + Number(match[2])) * 60 * 1000;
}

// Разбор страниц VLR.gg /matches и /matches/results в тот же вид, что
// был у расписания HenrikDev: остальной код (фильтр лиг, план
// публикаций, карточки) от источника не зависит. Возвращает и смещение
// пояса страницы (offsetMs, null — не удалось определить), чтобы
// fetchSchedule применил его к итогам, где обратного отсчёта нет.
function parseVlrPage(html, now = Date.now(), knownOffsetMs = null) {
    const tokens = [];
    const labelRe = /<div class="wf-label mod-large">\s*([^<]*?)\s*</g;
    const itemRe = /<a href="\/(\d+)\/([^"]*)" class="wf-module-item match-item[^"]*">([\s\S]*?)<\/a>/g;
    for (const m of html.matchAll(labelRe)) tokens.push({ index: m.index, label: m[1] });
    for (const m of html.matchAll(itemRe)) tokens.push({ index: m.index, id: m[1], slug: m[2], body: m[3] });
    tokens.sort((a, b) => a.index - b.index);

    const raw = [];
    let day = null;
    for (const token of tokens) {
        if (token.label !== undefined) {
            const d = token.label.match(/([A-Z][a-z]+) (\d{1,2}), (\d{4})/);
            day = d && MONTHS[d[1]] !== undefined ? { y: Number(d[3]), m: MONTHS[d[1]], d: Number(d[2]) } : null;
            continue;
        }
        const body = token.body;
        const time = stripTags(body.match(/<div class="match-item-time">([\s\S]*?)<\/div>/)?.[1] ?? '');
        const t = time.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
        const teamStarts = [...body.matchAll(/<div class="match-item-vs-team( mod-winner)?\s*">/g)];
        const etaIndex = body.indexOf('match-item-eta');
        const teams = teamStarts.map((tm, i) => {
            const segment = body.slice(tm.index, teamStarts[i + 1]?.index ?? (etaIndex === -1 ? undefined : etaIndex));
            const name = stripTags(segment.match(/<div class="text-of">([\s\S]*?)<\/div>/)?.[1] ?? '');
            const score = stripTags(segment.match(/match-item-vs-team-score[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '');
            return { name: name || 'TBD', has_won: Boolean(tm[1]), game_wins: /^\d+$/.test(score) ? Number(score) : 0 };
        });
        const eventBlock =
            body.match(
                /<div class="match-item-event text-of">([\s\S]*?)<\/div>\s*(?:<div class="match-item-icon"|$)/
            )?.[1] ?? '';
        const series = stripTags(
            eventBlock.match(/<div class="match-item-event-series[^"]*">([\s\S]*?)<\/div>/)?.[1] ?? ''
        );
        const event = stripTags(eventBlock.replace(/<div class="match-item-event-series[\s\S]*?<\/div>/, ''));
        const status = stripTags(body.match(/<div class="ml-status">([\s\S]*?)<\/div>/)?.[1] ?? '').toLowerCase();
        const eta = stripTags(body.match(/<div class="ml-eta[^"]*">([\s\S]*?)<\/div>/)?.[1] ?? '');
        const localMs =
            day && t
                ? Date.UTC(day.y, day.m, day.d, (Number(t[1]) % 12) + (t[3] === 'PM' ? 12 : 0), Number(t[2]))
                : day
                  ? Date.UTC(day.y, day.m, day.d)
                  : null;
        raw.push({ token, teams, series, event, status, eta, localMs, timeKnown: Boolean(t) });
    }

    // Пояс страницы: по первому матчу с точным обратным отсчётом.
    let offsetMs = knownOffsetMs;
    for (const r of raw) {
        const eta = parseEta(r.eta);
        if (r.localMs !== null && r.timeKnown && eta !== null && r.status === 'upcoming') {
            const quarter = 15 * 60 * 1000;
            const candidate = Math.round((r.localMs - (now + eta)) / quarter) * quarter;
            // Реальные пояса — от UTC−12 до UTC+14; всё остальное — сбой
            // отсчёта, тогда остаётся пояс по умолчанию.
            if (Math.abs(candidate) <= 14 * 3600 * 1000) {
                offsetMs = candidate;
                break;
            }
        }
    }

    const items = raw
        .filter(r => r.teams.length === 2)
        .map(r => {
            const offset = offsetMs ?? (r.localMs === null ? 0 : zoneOffsetMs(r.localMs, VLR_FALLBACK_TIME_ZONE));
            const state = r.status === 'completed' ? 'completed' : r.status === 'live' ? 'inProgress' : 'unstarted';
            return {
                date: r.localMs === null ? null : new Date(r.localMs - offset).toISOString(),
                timeKnown: r.timeKnown,
                state,
                league: { name: r.event || 'VALORANT Esports', identifier: r.token.slug },
                tournament: { name: r.series || null },
                match: { id: r.token.id, teams: r.teams, game_type: {} },
                url: `${VLR_BASE_URL}/${r.token.id}/${r.token.slug}`,
                vod: null,
            };
        });
    return { items, offsetMs };
}

function parseVlrMatches(html, now = Date.now(), knownOffsetMs = null) {
    return parseVlrPage(html, now, knownOffsetMs).items;
}

const RETRY_DELAY_MS = 3000;

// fetch с одной повторной попыткой при сетевой ошибке ("fetch failed" —
// DNS/сеть на сервере): разовый сбой не должен пропускать целую
// проверку. Ответ с ошибкой HTTP не повторяется — это не сбой сети.
async function fetchWithRetry(url, options) {
    try {
        return await fetch(url, options);
    } catch {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return fetch(url, options);
    }
}

async function fetchVlrPage(url) {
    const res = await fetchWithRetry(url, { headers: VLR_HEADERS });
    if (!res.ok) throw new Error(`VLR.gg ${url} ответил ${res.status}`);
    return res.text();
}

// Расписание + лайв (/matches) и итоги (/matches/results) одним списком.
// Пояс итогов — тот же, что вычислен по отсчёту на /matches: страницы
// открываются с одного сервера, VLR.gg показывает их в одном поясе.
async function fetchSchedule(now = Date.now()) {
    const [upcomingHtml, resultsHtml] = await Promise.all([
        fetchVlrPage(VLR_MATCHES_URL),
        fetchVlrPage(VLR_RESULTS_URL),
    ]);
    const upcoming = parseVlrPage(upcomingHtml, now);
    const results = parseVlrPage(resultsHtml, now, upcoming.offsetMs);
    return [...upcoming.items, ...results.items];
}

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(text) {
    return text
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => XML_ENTITIES[name])
        .trim();
}

function xmlTag(block, tag) {
    const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return match ? decodeXml(match[1]) : null;
}

// Смещения часовых поясов (в часах), которыми VLR.gg подписывает pubDate
// в RSS. Date сам понимает только американские (CDT, EST, ...), а VLR
// подписывает время поясом того, кто открывает сайт: с сервера в Европе
// приходит "CEST" — Date давал Invalid Date, и новость считалась старой
// и не публиковалась.
const TZ_ABBREVIATIONS = {
    UTC: 0,
    GMT: 0,
    WET: 0,
    WEST: 1,
    BST: 1,
    CET: 1,
    CEST: 2,
    EET: 2,
    EEST: 3,
    MSK: 3,
    EST: -5,
    EDT: -4,
    CST: -6,
    CDT: -5,
    MST: -7,
    MDT: -6,
    PST: -8,
    PDT: -7,
};

// "Thu, 24 Sep 2026 13:07:39 CEST" / "... +0200" → ISO или null.
function parseRssDate(text) {
    const value = String(text ?? '').trim();
    const abbr = value.match(/^(.*\d{1,2}:\d{2}(?::\d{2})?)\s+([A-Z]{2,5})$/);
    if (abbr && TZ_ABBREVIATIONS[abbr[2]] !== undefined) {
        const asUtc = Date.parse(`${abbr[1]} GMT`);
        if (Number.isFinite(asUtc)) return new Date(asUtc - TZ_ABBREVIATIONS[abbr[2]] * 3600 * 1000).toISOString();
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

// Разбор RSS VLR.gg в тот же вид, что у статей HenrikDev, — чтобы
// работали общие сверка по url и карточка новости (valorantNews/model.js).
function parseVlrRss(xml) {
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    return items
        .map(block => {
            return {
                title: xmlTag(block, 'title'),
                url: xmlTag(block, 'link') || xmlTag(block, 'guid'),
                description: xmlTag(block, 'description'),
                date: parseRssDate(xmlTag(block, 'pubDate')),
                category: 'vlr',
            };
        })
        .filter(a => a.title && a.url);
}

async function fetchVlrNews() {
    const res = await fetchWithRetry(VLR_RSS_URL, {
        headers: { 'User-Agent': 'ExtreeBot (Discord bot; VLR RSS reader)' },
    });
    if (!res.ok) throw new Error(`VLR.gg RSS ответил ${res.status}`);
    return parseVlrRss(await res.text());
}

function parseOgImage(html) {
    const match = html.match(/<meta property="og:image" content="([^"]*)"/);
    return match ? decodeXml(match[1]) : null;
}

// Картинка статьи VLR.gg — сама лента (fetchVlrNews) её не отдаёт, поэтому
// приходится открывать страницу статьи и брать og:image оттуда. null —
// у статьи нет своей картинки (VLR_GENERIC_IMAGE) или страницу не удалось
// загрузить: тогда карточка публикуется без картинки, а не отваливается.
async function fetchVlrArticleImage(url) {
    let res;
    try {
        res = await fetchWithRetry(url, { headers: VLR_HEADERS });
    } catch (err) {
        console.error('valorantEsports: не удалось загрузить страницу статьи для картинки:', err.message);
        return null;
    }
    if (!res.ok) return null;
    const image = parseOgImage(await res.text());
    return image && image !== VLR_GENERIC_IMAGE ? image : null;
}

function isTracked(item) {
    // Только VLR-адрес матча не должен включать фильтр: в slug бывает
    // "champions" и у Game Changers ("...-championship" отсекается \b, но
    // адрес не участвует вовсе — только названия турнира и стадии).
    const text = [item?.league?.name, item?.tournament?.name].filter(Boolean).join(' ').replace(/[_-]/g, ' ');
    return TRACKED_REGEX.test(text);
}

// Статус матча: unstarted / inProgress / completed (parseVlrMatches
// приводит статусы VLR.gg к этим значениям).
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
        const time = i.timeKnown === false ? 'время уточняется' : `<t:${unixSeconds(i.date)}:t>`;
        return `${time} — **${teamName(a)}** vs **${teamName(b)}**${extra ? ` · ${extra}` : ''}`;
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
    const buttons = [];
    if (item.url)
        buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Матч на VLR.gg').setURL(item.url));
    if (item.vod)
        buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Запись матча').setURL(item.vod));
    if (buttons.length) {
        container.addSeparatorComponents(separator());
        container.addActionRowComponents(new ActionRowBuilder().addComponents(...buttons));
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

// Новости VLR.gg: публикуются все, без фильтра по лигам, с пингом роли
// киберспорта (по просьбе администратора, хотя их бывает по 10-15 в день).
async function checkVlrNews(channel, cfg, badgeEmoji) {
    let articles;
    try {
        articles = await fetchVlrNews();
    } catch (err) {
        console.error('valorantEsports: не удалось получить новости VLR.gg:', err.message);
        return;
    }
    if (!articles.length) return;

    if (!Array.isArray(cfg.seenVlrUrls)) {
        await config.update(c => {
            c.seenVlrUrls = news.mergeSeenKeys(articles, []);
        });
        return;
    }

    const unseen = news.findUnseenArticles(articles, cfg.seenVlrUrls);
    if (!unseen.length) return;
    const { articles: toPost, tooMany } = news.selectArticlesToPost(unseen);
    if (tooMany)
        console.warn('valorantEsports: слишком много "новых" новостей VLR.gg — похоже на сбой сверки, не публикую.');
    for (const article of toPost) {
        article.banner_url = await fetchVlrArticleImage(article.url);
        await send(channel, news.buildNewsCard(article, cfg.pingRoleId, badgeEmoji));
    }
    await config.update(c => {
        c.seenVlrUrls = news.mergeSeenKeys(articles, Array.isArray(c.seenVlrUrls) ? c.seenVlrUrls : []);
    });
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
    const cfg = await config.load();
    const channel = await resolveChannel(client, cfg.channelId);
    if (!channel) return;
    const badgeEmoji = news.resolveBadgeEmoji(channel.guild);
    await checkVlrNews(channel, cfg, badgeEmoji);
    // Официальные статьи Riot — через HenrikDev, им нужен ключ; VLR.gg
    // (новости и матчи) открыт и работает без него.
    if (process.env.HENRIKDEV_API_KEY) await checkArticles(channel, cfg, badgeEmoji);
    await checkMatches(channel, cfg, badgeEmoji);
}

module.exports = {
    parseRssDate,
    parseVlrRss,
    parseVlrMatches,
    parseEta,
    zoneOffsetMs,
    fetchVlrNews,
    parseOgImage,
    fetchVlrArticleImage,
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
