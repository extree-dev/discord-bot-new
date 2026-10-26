const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidGeoBypassToken } = require('../dashboard/geoBypass');

test('isValidGeoBypassToken: совпадающий токен — true', () => {
    assert.equal(isValidGeoBypassToken('s3cr3t-token', 's3cr3t-token'), true);
});

test('isValidGeoBypassToken: неверный токен — false', () => {
    assert.equal(isValidGeoBypassToken('wrong', 's3cr3t-token'), false);
});

test('isValidGeoBypassToken: токен другой длины — false, без исключения', () => {
    assert.equal(isValidGeoBypassToken('short', 's3cr3t-token'), false);
});

test('isValidGeoBypassToken: GEO_BYPASS_TOKEN не задан — bypass выключен', () => {
    assert.equal(isValidGeoBypassToken('anything', ''), false);
    assert.equal(isValidGeoBypassToken('anything', undefined), false);
});

test('isValidGeoBypassToken: пустой переданный токен — false', () => {
    assert.equal(isValidGeoBypassToken('', 's3cr3t-token'), false);
    assert.equal(isValidGeoBypassToken(undefined, 's3cr3t-token'), false);
});
