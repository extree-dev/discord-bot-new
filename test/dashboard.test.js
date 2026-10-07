const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isGuildAdmin,
    intersectManagedGuilds,
    buildAuthorizeUrl,
    isSiteAdmin,
    isMemberAdmin,
    fetchGuildWithCounts,
} = require('../dashboard/discordOAuth');
const { encryptSession, decryptSession } = require('../dashboard/session');

test('isGuildAdmin: владелец сервера — всегда админ, даже без явного права', () => {
    assert.equal(isGuildAdmin({ owner: true, permissions: '0' }), true);
});

test('isGuildAdmin: бит Administrator (0x8) — админ', () => {
    assert.equal(isGuildAdmin({ owner: false, permissions: String(0x8) }), true);
    assert.equal(isGuildAdmin({ owner: false, permissions: String(0x8 | 0x400) }), true);
});

test('isGuildAdmin: без бита Administrator и без owner — не админ', () => {
    assert.equal(isGuildAdmin({ owner: false, permissions: String(0x400) }), false);
    assert.equal(isGuildAdmin({ owner: false, permissions: '0' }), false);
});

test('isGuildAdmin: право выше 32 бит сравнивается корректно (BigInt, не побитовый JS-оператор)', () => {
    const huge = (1n << 40n) | 0x8n;
    assert.equal(isGuildAdmin({ owner: false, permissions: huge.toString() }), true);
});

test('intersectManagedGuilds: только сервера, где юзер админ/владелец И есть бот', () => {
    const userGuilds = [
        { id: '1', name: 'Mine', owner: true, permissions: '0' },
        { id: '2', name: 'NotAdmin', owner: false, permissions: '0' },
        { id: '3', name: 'AdminNoBot', owner: false, permissions: String(0x8) },
        { id: '4', name: 'AdminWithBot', owner: false, permissions: String(0x8) },
    ];
    const botGuilds = [{ id: '1' }, { id: '4' }, { id: '99' }];

    const result = intersectManagedGuilds(userGuilds, botGuilds);
    assert.deepEqual(
        result.map(g => g.id),
        ['1', '4']
    );
});

test('intersectManagedGuilds: пустой список, если нет пересечения', () => {
    assert.deepEqual(intersectManagedGuilds([{ id: '1', owner: true, permissions: '0' }], [{ id: '2' }]), []);
});

test('buildAuthorizeUrl: собирает правильный URL авторизации Discord', () => {
    const url = buildAuthorizeUrl({ clientId: 'abc', redirectUri: 'https://example.com/cb', state: 'xyz' });
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, 'https://discord.com/oauth2/authorize');
    assert.equal(parsed.searchParams.get('client_id'), 'abc');
    assert.equal(parsed.searchParams.get('redirect_uri'), 'https://example.com/cb');
    assert.equal(parsed.searchParams.get('response_type'), 'code');
    assert.equal(parsed.searchParams.get('scope'), 'identify guilds');
    assert.equal(parsed.searchParams.get('state'), 'xyz');
});

test('session: шифрование/расшифровка — круглый путь без потерь', () => {
    const payload = { accessToken: 'secret-token-value', issuedAt: 1700000000000 };
    const token = encryptSession(payload, 'super-secret');
    assert.deepEqual(decryptSession(token, 'super-secret'), payload);
});

test('session: неверный секрет — не расшифровывается (не бросает исключение)', () => {
    const token = encryptSession({ accessToken: 'x' }, 'secret-a');
    assert.equal(decryptSession(token, 'secret-b'), null);
});

test('session: испорченная cookie (подмена байтов) — null, а не исключение', () => {
    const token = encryptSession({ accessToken: 'x' }, 'secret');
    const tampered = token.slice(0, -4) + 'aaaa';
    assert.equal(decryptSession(tampered, 'secret'), null);
});

test('isSiteAdmin: админ/владелец ровно на нужном guildId — true', () => {
    const userGuilds = [
        { id: '1', owner: false, permissions: '0' },
        { id: '2', owner: true, permissions: '0' },
    ];
    assert.equal(isSiteAdmin(userGuilds, '2'), true);
});

test('isSiteAdmin: нужного guildId нет в списке серверов пользователя — false', () => {
    const userGuilds = [{ id: '1', owner: true, permissions: '0' }];
    assert.equal(isSiteAdmin(userGuilds, '2'), false);
});

test('isSiteAdmin: есть нужный guildId, но без прав администратора — false', () => {
    const userGuilds = [{ id: '2', owner: false, permissions: '0' }];
    assert.equal(isSiteAdmin(userGuilds, '2'), false);
});

test('isSiteAdmin: guildId не задан — false', () => {
    const userGuilds = [{ id: '2', owner: true, permissions: '0' }];
    assert.equal(isSiteAdmin(userGuilds, undefined), false);
});

test('session: мусорная строка вместо cookie — null', () => {
    assert.equal(decryptSession('not-a-valid-token', 'secret'), null);
    assert.equal(decryptSession('', 'secret'), null);
});

test('isMemberAdmin: владелец сервера — всегда админ, даже без ролей', () => {
    const guild = { owner_id: 'u1' };
    const member = { user: { id: 'u1' }, roles: [] };
    assert.equal(isMemberAdmin({ ownerId: guild.owner_id, member, roles: [] }), true);
});

test('isMemberAdmin: роль с правом Administrator (0x8) среди ролей участника — админ', () => {
    const roles = [
        { id: 'r1', permissions: String(0x8) },
        { id: 'r2', permissions: String(0x400) },
    ];
    const member = { user: { id: 'u2' }, roles: ['r2'] };
    assert.equal(isMemberAdmin({ ownerId: 'owner', member, roles }), false);
    assert.equal(isMemberAdmin({ ownerId: 'owner', member: { ...member, roles: ['r1', 'r2'] }, roles }), true);
});

test('isMemberAdmin: participant не на сервере (member === null) — false', () => {
    assert.equal(isMemberAdmin({ ownerId: 'owner', member: null, roles: [] }), false);
});

test('isMemberAdmin: право выше 32 бит складывается через BigInt корректно', () => {
    const huge = (1n << 40n) | 0x8n;
    const roles = [{ id: 'r1', permissions: huge.toString() }];
    const member = { user: { id: 'u3' }, roles: ['r1'] };
    assert.equal(isMemberAdmin({ ownerId: 'owner', member, roles }), true);
});

test('fetchGuildWithCounts: запрашивает with_counts=true и отдаёт ответ Discord как есть', async () => {
    const realFetch = global.fetch;
    let requestedUrl;
    try {
        global.fetch = async (url, init) => {
            requestedUrl = url;
            assert.equal(init.headers.Authorization, 'Bot test-token');
            return {
                ok: true,
                json: async () => ({ id: 'g1', approximate_member_count: 42, approximate_presence_count: 7 }),
            };
        };
        const guild = await fetchGuildWithCounts('test-token', 'g1');
        assert.equal(guild.approximate_member_count, 42);
        assert.equal(guild.approximate_presence_count, 7);
        assert.ok(String(requestedUrl).includes('with_counts=true'));
    } finally {
        global.fetch = realFetch;
    }
});
