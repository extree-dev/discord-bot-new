// Общий список игр для новостных каналов (см. gameNews/config.js,
// scripts/setup-game-news.js) и панели ролей (rolePanel/) — те же игры
// и в том же порядке, что и в пуле игровых ролей адаптации
// (scripts/add-onboarding-role-questions.js ROLE_CATEGORIES['На какой
// игре тебя чаще видно?'] и scripts/reorganize-custom-roles.js
// COSMETIC_ROLE_NAMES), КРОМЕ Valorant — по прямому запросу
// администратора: у Valorant уже есть отдельная полноценная система
// новостей (valorantNews/, канал #📬│game-news + #📬│esports-news) и
// своя игровая роль в адаптации, второй пустой канал/роль-пинг здесь
// были бы просто дублем. name должен совпадать с названием игровой роли
// (по нему находится роль "играю в это" для панели). color — тот же
// цвет, что и у игровой роли в адаптации, переиспользуется для отдельной
// роли-пинга новостей (scripts/setup-game-news.js создаёт "Новости: <Game>").
// customEmojiName — тот же кастомный эмодзи сервера, что и у игровой
// роли в адаптации (см. resolveEmoji в scripts/setup-role-panel.js) —
// используется только в панели (StringSelectMenu поддерживает кастомные
// эмодзи), НЕ в названии канала (Discord не рисует кастомные эмодзи в
// названиях каналов — там emoji ниже, обычный юникод, единственный
// вариант, который там работает).
const GAMES = [
    { key: 'cs2', name: 'CS2', slug: 'cs2', emoji: '🔫', color: 0xf39c12, customEmojiName: '28349cs2' },
    {
        key: 'war-thunder',
        name: 'War Thunder',
        slug: 'war-thunder',
        emoji: '✈️',
        color: 0x34495e,
        customEmojiName: 'icons8warthunder48',
    },
    {
        key: 'call-of-duty',
        name: 'Call of Duty',
        slug: 'call-of-duty',
        emoji: '🪖',
        color: 0x4b5320,
        customEmojiName: 'icons8callofduty100',
    },
    { key: 'dota-2', name: 'Dota 2', slug: 'dota-2', emoji: '🧙', color: 0x6c3483, customEmojiName: 'dota' },
    {
        key: 'apex-legends',
        name: 'Apex Legends',
        slug: 'apex-legends',
        emoji: '🪂',
        color: 0xff8c00,
        customEmojiName: '943178apexlegends',
    },
    {
        key: 'minecraft',
        name: 'Minecraft',
        slug: 'minecraft',
        emoji: '⛏️',
        color: 0x5d8f3d,
        customEmojiName: 'icons8minecraft50',
    },
    { key: 'gta', name: 'GTA', slug: 'gta', emoji: '🚗', color: 0xffd700, customEmojiName: 'icons8gta548' },
];

// Название роли-пинга новостей по игре — не совпадает с названием самой
// игровой роли (game.name), чтобы не путать "играю в это" (пул ролей
// адаптации) и "хочу знать новости об этом" (эта роль).
function newsRoleName(game) {
    return `Новости: ${game.name}`;
}

module.exports = { GAMES, newsRoleName };
