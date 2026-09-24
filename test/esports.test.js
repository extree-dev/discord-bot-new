const test = require('node:test');
const assert = require('node:assert/strict');
const {
    parseRssDate,
    fetchSchedule,
    parseVlrRss,
    parseVlrMatches,
    parseEta,
    isTracked,
    matchState,
    matchKey,
    planMatchPosts,
    todaysMatches,
    dateInZone,
    hourInZone,
    buildDigestCard,
    buildResultCard,
} = require('../valorantNews/esports');

function match(id, { state = 'unstarted', date = '2026-09-24T15:00:00Z', league = 'VCT Champions', a, b } = {}) {
    return {
        date,
        state,
        type: 'match',
        league: { name: league, identifier: league.toLowerCase().replace(/ /g, '_'), icon: '', region: 'INTL' },
        tournament: { name: 'Champions 2026', season: '2026' },
        match: {
            id,
            game_type: { type: 'bestOf', count: 3 },
            teams: [
                { name: 'Team A', code: 'A', icon: '', has_won: false, game_wins: 0, record: {}, ...a },
                { name: 'Team B', code: 'B', icon: '', has_won: false, game_wins: 0, record: {}, ...b },
            ],
        },
        vod: null,
    };
}

test('isTracked: VCT, Masters и Champions — да, Challengers и Game Changers Championship — нет', () => {
    assert.equal(isTracked(match('1', { league: 'VCT Americas' })), true);
    assert.equal(isTracked({ league: { name: 'VCT 2026: Americas Stage 2' }, tournament: {} }), true);
    assert.equal(isTracked(match('2', { league: 'Champions' })), true);
    assert.equal(isTracked(match('3', { league: 'Masters' })), true);
    assert.equal(
        isTracked({
            league: { name: 'Challengers NA', identifier: 'challengers_na' },
            tournament: { name: 'Stage 1' },
        }),
        false
    );
    assert.equal(
        isTracked({
            league: { name: 'Game Changers', identifier: 'game_changers' },
            tournament: { name: 'Game Changers Championship' },
        }),
        false
    );
});

test('matchState: статусы Riot приводятся к upcoming / live / completed', () => {
    assert.equal(matchState({ state: 'unstarted' }), 'upcoming');
    assert.equal(matchState({ state: 'inProgress' }), 'live');
    assert.equal(matchState({ state: 'in_progress' }), 'live');
    assert.equal(matchState({ state: 'completed' }), 'completed');
});

test('matchKey: id матча, а без него — дата и команды', () => {
    assert.equal(matchKey(match('abc')), 'abc');
    assert.equal(matchKey(match(null)), '2026-09-24T15:00:00Z|Team A|Team B');
});

test('planMatchPosts: "начался" и итог — по одному разу, старые итоги не публикуются', () => {
    const now = new Date('2026-09-24T18:00:00Z').getTime();
    const live = match('live', { state: 'inProgress' });
    const done = match('done', { state: 'completed', a: { has_won: true, game_wins: 2 }, b: { game_wins: 1 } });
    const old = match('old', { state: 'completed', date: '2026-09-20T15:00:00Z' });
    const later = match('later');

    const first = planMatchPosts([live, done, old, later], [], [], now);
    assert.deepEqual(first.started.map(matchKey), ['live']);
    assert.deepEqual(first.finished.map(matchKey), ['done']);

    const second = planMatchPosts([live, done, old, later], first.liveKeys, first.resultKeys, now);
    assert.deepEqual(second.started, []);
    assert.deepEqual(second.finished, []);
});

test('planMatchPosts: слишком много "новых" матчей разом — сбой сверки, ничего не публикуем', () => {
    const now = new Date('2026-09-24T18:00:00Z').getTime();
    const many = Array.from({ length: 7 }, (_, i) => match(`m${i}`, { state: 'completed' }));
    const plan = planMatchPosts(many, [], [], now);
    assert.equal(plan.tooMany, true);
    assert.deepEqual(plan.finished, []);
    assert.equal(plan.resultKeys.length, 7);
});

test('todaysMatches: только сегодняшние по Москве и ещё не завершённые', () => {
    const now = new Date('2026-09-24T07:30:00Z').getTime(); // 10:30 МСК
    assert.equal(dateInZone(now), '2026-09-24');
    assert.equal(hourInZone(now), 10);
    const today = match('t', { date: '2026-09-24T16:00:00Z' });
    const lateNight = match('n', { date: '2026-09-24T22:30:00Z' }); // 01:30 МСК следующего дня
    const finished = match('f', { date: '2026-09-24T05:00:00Z', state: 'completed' });
    assert.deepEqual(todaysMatches([lateNight, today, finished], now).map(matchKey), ['t']);
});

test('карточки: сводка с пингом роли, итог со счётом и победителем', () => {
    const digest = JSON.stringify(buildDigestCard([match('x')], '42', '🎯').toJSON());
    assert.ok(digest.includes('<@&42>'));
    assert.ok(digest.includes('Матчи сегодня'));
    assert.ok(digest.includes('**Team A** vs **Team B**'));

    const result = JSON.stringify(
        buildResultCard(
            match('r', { state: 'completed', a: { has_won: true, game_wins: 2 }, b: { game_wins: 1 } }),
            '🎯'
        ).toJSON()
    );
    assert.ok(result.includes('Team A 2 : 1 Team B'));
    assert.ok(result.includes('Победитель: **Team A**'));
});

test('parseVlrRss: новости VLR.gg из RSS — заголовок, ссылка, дата, описание, спецсимволы декодированы', () => {
    const xml = `<?xml version="1.0"?><rss><channel><title>VLR.gg</title><description>site</description>
<item>
    <title>Coach Joe: &quot;[Shopify] is the team to beat&quot;</title>
    <link>https://www.vlr.gg/757396/coach-joe</link>
    <guid isPermaLink="true">https://www.vlr.gg/757396/coach-joe</guid>
    <pubDate>Fri, 18 Sep 2026 22:23:28 CDT</pubDate>
    <description>FlyQuest RED&#039;s Head Coach &amp; team.</description>
</item>
<item><title><![CDATA[LOUD adds balax]]></title><link>https://www.vlr.gg/757962/loud</link><pubDate>bad date</pubDate></item>
<item><description>без заголовка и ссылки</description></item>
</channel></rss>`;
    const items = parseVlrRss(xml);
    assert.equal(items.length, 2);
    assert.deepEqual(items[0], {
        title: 'Coach Joe: "[Shopify] is the team to beat"',
        url: 'https://www.vlr.gg/757396/coach-joe',
        description: "FlyQuest RED's Head Coach & team.",
        date: '2026-09-19T03:23:28.000Z',
        category: 'vlr',
    });
    assert.equal(items[1].title, 'LOUD adds balax');
    assert.equal(items[1].date, null);
});

function vlrItem({ id, slug, time, teams, status, eta, series, event }) {
    const team = ([name, score, winner]) => `
                            <div class="match-item-vs-team ${winner ? 'mod-winner' : ''}">
                                <div class="match-item-vs-team-name">
                                    <div class="text-of">
                                        <span class="flag mod-eu"></span>
                                        ${name}                                    </div>
                                </div>
                                <div class="match-item-vs-team-score mod-upcoming">
                                    ${score}
                                </div>
                            </div>`;
    return `<a href="/${id}/${slug}" class="wf-module-item match-item mod-color">
        <div class="match-item-time">
            ${time}        </div>
        <div class="match-item-vs">${teams.map(team).join('')}
        </div>
        <div class="match-item-eta"><div class="ml"><div class="ml-status">${status}</div><div class="ml-eta">${eta}</div></div></div>
        <div class="match-item-event text-of">
            <div class="match-item-event-series text-of">
                ${series}            </div>
            ${event}        </div>
        <div class="match-item-icon"><img src="//owcdn.net/img/x.png"></div>
    </a>`;
}

test('parseEta: точным считается только отсчёт с минутами', () => {
    assert.equal(parseEta('14h 19m'), (14 * 60 + 19) * 60000);
    assert.equal(parseEta('45m'), 45 * 60000);
    assert.equal(parseEta('1d 14h'), null);
});

test('parseVlrMatches: расписание VLR.gg — время по отсчёту до матча, команды, турнир и стадия', () => {
    const html = `<div class="wf-label mod-large">
            Thu, September 24, 2026 <span class="wf-tag">Tomorrow</span>
        </div><div class="wf-card">
        ${vlrItem({
            id: '753455',
            slug: 'team-liquid-vs-paper-rex-valorant-champions-2026-opening-c',
            time: '4:00 AM',
            teams: [
                ['Team Liquid', '&ndash;'],
                ['Paper Rex', '&ndash;'],
            ],
            status: 'Upcoming',
            eta: '14h 19m',
            series: 'Group Stage&ndash;Opening (C)',
            event: 'Valorant Champions 2026',
        })}
        ${vlrItem({
            id: '1',
            slug: 'x-vs-y',
            time: 'TBD',
            teams: [
                ['TBD', '&ndash;'],
                ['TBD', '&ndash;'],
            ],
            status: 'Upcoming',
            eta: '1d 3h',
            series: 'Playoffs',
            event: 'Valorant Champions 2026',
        })}</div>`;
    const now = Date.parse('2026-09-23T18:40:30Z');
    const [first, tbd] = parseVlrMatches(html, now);
    assert.equal(first.date, '2026-09-24T09:00:00.000Z');
    assert.equal(first.state, 'unstarted');
    assert.equal(first.league.name, 'Valorant Champions 2026');
    assert.equal(first.tournament.name, 'Group Stage–Opening (C)');
    assert.deepEqual(
        first.match.teams.map(t => t.name),
        ['Team Liquid', 'Paper Rex']
    );
    assert.equal(first.match.id, '753455');
    assert.equal(first.url, 'https://www.vlr.gg/753455/team-liquid-vs-paper-rex-valorant-champions-2026-opening-c');
    assert.equal(isTracked(first), true);
    assert.equal(tbd.timeKnown, false);
});

test('parseVlrMatches: итоги VLR.gg — счёт и победитель, время по поясу США без отсчёта', () => {
    const html = `<div class="wf-label mod-large">Sun, September 20, 2026</div>
        ${vlrItem({
            id: '755371',
            slug: 'havoc-vs-nova-game-changers-2026-china-gf',
            time: '4:00 AM',
            teams: [
                ['Havoc &amp; Yonder GC', '1'],
                ['Nova Esports GC', '3', true],
            ],
            status: 'Completed',
            eta: '3d 9h',
            series: 'Main Event&ndash;Grand Final',
            event: 'Game Changers 2026: China',
        })}`;
    const [result] = parseVlrMatches(html, Date.parse('2026-09-23T18:40:00Z'));
    assert.equal(result.state, 'completed');
    assert.equal(result.date, '2026-09-20T09:00:00.000Z'); // 4:00 AM CDT
    assert.deepEqual(result.match.teams, [
        { name: 'Havoc & Yonder GC', has_won: false, game_wins: 1 },
        { name: 'Nova Esports GC', has_won: true, game_wins: 3 },
    ]);
    assert.equal(isTracked(result), false);
});

test('parseVlrMatches: матч в эфире — статус LIVE', () => {
    const html = `<div class="wf-label mod-large">Thu, September 24, 2026</div>
        ${vlrItem({
            id: '2',
            slug: 'a-vs-b',
            time: '4:00 AM',
            teams: [
                ['A', '1'],
                ['B', '0'],
            ],
            status: 'LIVE',
            eta: '',
            series: 'Group Stage',
            event: 'Valorant Champions 2026',
        })}`;
    const [live] = parseVlrMatches(html, Date.parse('2026-09-24T09:10:00Z'));
    assert.equal(live.state, 'inProgress');
});

test('parseRssDate: европейские и американские пояса VLR.gg, числовое смещение, мусор', () => {
    assert.equal(parseRssDate('Thu, 24 Sep 2026 13:07:39 CEST'), '2026-09-24T11:07:39.000Z');
    assert.equal(parseRssDate('Thu, 24 Sep 2026 06:07:39 CDT'), '2026-09-24T11:07:39.000Z');
    assert.equal(parseRssDate('Thu, 24 Sep 2026 14:07:39 MSK'), '2026-09-24T11:07:39.000Z');
    assert.equal(parseRssDate('Thu, 24 Sep 2026 13:07:39 +0200'), '2026-09-24T11:07:39.000Z');
    assert.equal(parseRssDate('bad date'), null);
    assert.equal(parseRssDate(undefined), null);
});

test('parseVlrRss: новость с датой в CEST (сервер в Европе) получает дату, а не null', () => {
    const xml = `<rss><channel><item><title>Paper Rex shuts down Team Liquid</title>
        <link>https://www.vlr.gg/758987/paper-rex</link>
        <pubDate>Thu, 24 Sep 2026 13:07:39 CEST</pubDate></item></channel></rss>`;
    assert.equal(parseVlrRss(xml)[0].date, '2026-09-24T11:07:39.000Z');
});

test('fetchSchedule: итоги берут пояс страницы расписания (сервер в Европе, CEST)', async () => {
    const upcomingHtml = `<div class="wf-label mod-large">Thu, September 24, 2026</div>${vlrItem({
        id: '10',
        slug: 'tyloo-vs-g2',
        time: '2:00 PM',
        teams: [
            ['TYLOO', '&ndash;'],
            ['G2 Esports', '&ndash;'],
        ],
        status: 'Upcoming',
        eta: '1h 0m',
        series: 'Group Stage',
        event: 'Valorant Champions 2026',
    })}`;
    const resultsHtml = `<div class="wf-label mod-large">Thu, September 24, 2026</div>${vlrItem({
        id: '11',
        slug: 'liquid-vs-prx',
        time: '11:00 AM',
        teams: [
            ['Team Liquid', '0'],
            ['Paper Rex', '2', true],
        ],
        status: 'Completed',
        eta: '2h 5m',
        series: 'Group Stage',
        event: 'Valorant Champions 2026',
    })}`;
    const realFetch = global.fetch;
    global.fetch = async url => ({
        ok: true,
        text: async () => (url.endsWith('/matches/results') ? resultsHtml : upcomingHtml),
    });
    try {
        // Сейчас 11:00 UTC = 13:00 CEST; до матча TYLOO — G2 (14:00 CEST) час.
        const items = await fetchSchedule(Date.parse('2026-09-24T11:00:00Z'));
        const result = items.find(i => i.match.id === '11');
        assert.equal(items.find(i => i.match.id === '10').date, '2026-09-24T12:00:00.000Z');
        assert.equal(result.date, '2026-09-24T09:00:00.000Z'); // 11:00 CEST
        assert.equal(result.state, 'completed');
    } finally {
        global.fetch = realFetch;
    }
});
