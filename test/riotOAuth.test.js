const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAuthorizeUrl } = require('../stats-backend/riotOAuth');

test('buildAuthorizeUrl: собирает authorize URL со всеми обязательными параметрами', () => {
    const url = new URL(
        buildAuthorizeUrl({
            clientId: 'test-client',
            redirectUri: 'https://stats.extree.tech/auth/riot/callback',
            state: 'abc123',
        })
    );
    assert.equal(url.origin + url.pathname, 'https://auth.riotgames.com/authorize');
    assert.equal(url.searchParams.get('client_id'), 'test-client');
    assert.equal(url.searchParams.get('redirect_uri'), 'https://stats.extree.tech/auth/riot/callback');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('state'), 'abc123');
    assert.ok(url.searchParams.get('scope').includes('openid'));
});
