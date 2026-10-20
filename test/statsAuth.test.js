const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, isValidEmail, isValidPassword } = require('../stats-backend/validation');
const { hashPassword, verifyPasswordHash } = require('../stats-backend/users');
const { lookupLocation } = require('../stats-backend/geo');

test('normalizeEmail: обрезает пробелы и приводит к нижнему регистру', () => {
    assert.equal(normalizeEmail('  User@Example.com '), 'user@example.com');
    assert.equal(normalizeEmail(undefined), '');
});

test('isValidEmail: отличает корректные адреса от некорректных', () => {
    assert.equal(isValidEmail('user@example.com'), true);
    assert.equal(isValidEmail('not-an-email'), false);
    assert.equal(isValidEmail(''), false);
});

test('isValidPassword: минимум 8 символов, максимум 200', () => {
    assert.equal(isValidPassword('short'), false);
    assert.equal(isValidPassword('longenough'), true);
    assert.equal(isValidPassword('a'.repeat(201)), false);
    assert.equal(isValidPassword(undefined), false);
});

test('hashPassword/verifyPasswordHash: верный пароль проходит, неверный — нет', () => {
    const hash = hashPassword('correct horse battery staple');
    assert.equal(verifyPasswordHash('correct horse battery staple', hash), true);
    assert.equal(verifyPasswordHash('wrong password', hash), false);
});

test('verifyPasswordHash: не падает на пустом/битом хеше', () => {
    assert.equal(verifyPasswordHash('anything', null), false);
    assert.equal(verifyPasswordHash('anything', 'not-a-valid-hash'), false);
});

test('lookupLocation: находит страну по публичному IP', () => {
    const result = lookupLocation('8.8.8.8');
    assert.equal(result.country, 'US');
});

test('lookupLocation: не падает и возвращает null на локальном/приватном адресе', () => {
    assert.deepEqual(lookupLocation('127.0.0.1'), { country: null, city: null });
    assert.deepEqual(lookupLocation('10.0.0.5'), { country: null, city: null });
});

test('lookupLocation: отсекает некорректные/не-IP строки до geoip-lite (защита от DoS на парсинге)', () => {
    assert.deepEqual(lookupLocation('not-an-ip'), { country: null, city: null });
    assert.deepEqual(lookupLocation('1'.repeat(10000)), { country: null, city: null });
    assert.deepEqual(lookupLocation(''), { country: null, city: null });
    assert.deepEqual(lookupLocation(undefined), { country: null, city: null });
});
