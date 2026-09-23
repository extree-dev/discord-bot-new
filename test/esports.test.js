const test = require('node:test');
const assert = require('node:assert/strict');
const {
    parseVlrRss,
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
    assert.equal(isTracked({ league: { name: 'Americas', identifier: 'vct_americas' }, tournament: {} }), true);
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
