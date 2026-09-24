// Общий список игр для будущих новостных каналов (см. gameNews/config.js,
// scripts/setup-game-news.js) и панели ролей (rolePanel/) — те же 8 игр
// и в том же порядке, что и в пуле игровых ролей адаптации
// (scripts/add-onboarding-role-questions.js ROLE_CATEGORIES['На какой
// игре тебя чаще видно?'] и scripts/reorganize-custom-roles.js
// COSMETIC_ROLE_NAMES). name должен совпадать с названием игровой роли
// (по нему находится роль "играю в это" для панели). color — тот же
// цвет, что и у игровой роли в адаптации, переиспользуется для отдельной
// роли-пинга новостей (scripts/setup-game-news.js создаёт "Новости: <Game>").
const GAMES = [
    { key: 'valorant', name: 'Valorant', slug: 'valorant', emoji: '🎯', color: 0xff4655 },
    { key: 'cs2', name: 'CS2', slug: 'cs2', emoji: '🔫', color: 0xf39c12 },
    { key: 'war-thunder', name: 'War Thunder', slug: 'war-thunder', emoji: '✈️', color: 0x34495e },
    { key: 'call-of-duty', name: 'Call of Duty', slug: 'call-of-duty', emoji: '🪖', color: 0x4b5320 },
    { key: 'dota-2', name: 'Dota 2', slug: 'dota-2', emoji: '🧙', color: 0x6c3483 },
    { key: 'apex-legends', name: 'Apex Legends', slug: 'apex-legends', emoji: '🪂', color: 0xff8c00 },
    { key: 'minecraft', name: 'Minecraft', slug: 'minecraft', emoji: '⛏️', color: 0x5d8f3d },
    { key: 'gta', name: 'GTA', slug: 'gta', emoji: '🚗', color: 0xffd700 },
];

// Название роли-пинга новостей по игре — не совпадает с названием самой
// игровой роли (game.name), чтобы не путать "играю в это" (пул ролей
// адаптации) и "хочу знать новости об этом" (эта роль).
function newsRoleName(game) {
    return `Новости: ${game.name}`;
}

module.exports = { GAMES, newsRoleName };
