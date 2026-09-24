// Общий список игр для будущих новостных каналов (см. gameNews/config.js,
// scripts/setup-game-news.js) — те же 8 игр и в том же порядке, что и в
// пуле игровых ролей адаптации (scripts/add-onboarding-role-questions.js
// ROLE_CATEGORIES['На какой игре тебя чаще видно?'] и
// scripts/reorganize-custom-roles.js COSMETIC_ROLE_NAMES). name должен
// совпадать с названием роли — по нему позже будет находиться роль для
// пинга, когда подключится Steam API.
const GAMES = [
    { key: 'valorant', name: 'Valorant', slug: 'valorant', emoji: '🎯' },
    { key: 'cs2', name: 'CS2', slug: 'cs2', emoji: '🔫' },
    { key: 'war-thunder', name: 'War Thunder', slug: 'war-thunder', emoji: '✈️' },
    { key: 'call-of-duty', name: 'Call of Duty', slug: 'call-of-duty', emoji: '🪖' },
    { key: 'dota-2', name: 'Dota 2', slug: 'dota-2', emoji: '🧙' },
    { key: 'apex-legends', name: 'Apex Legends', slug: 'apex-legends', emoji: '🪂' },
    { key: 'minecraft', name: 'Minecraft', slug: 'minecraft', emoji: '⛏️' },
    { key: 'gta', name: 'GTA', slug: 'gta', emoji: '🚗' },
];

module.exports = { GAMES };
