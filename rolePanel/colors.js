// Готовый набор цветов для персональной роли-цвета — самостоятельный
// третий выбор в панели rolePanel/, не связан с игровыми ролями и не
// влияет ни на кого другого: красит только ник того, кто выбрал (в
// отличие от смены цвета самой игровой/ярусной роли — она бы покрасила
// всех, у кого эта роль есть). Роли создаёт scripts/setup-role-panel.js
// (--bootstrap) под именем "Цвет: <name>"; их позицию в иерархии —
// scripts/reorganize-custom-roles.js, ВЫШЕ ярусов активности
// (leveling/model.js LEVELS — у каждого яруса свой цвет), иначе цвет
// яруса всегда перебивал бы выбор участника и вся фича была бы не видна
// никому, кто прошёл уровень "Новичок".
//
// emoji — юникод-запасной вариант; customEmojiName — залитый под цвет
// кастомный эмодзи сервера (scripts/upload-color-emojis.js, разовый
// ручной скрипт), который scripts/setup-role-panel.js подставляет в
// панель вместо юникода, если он найден на сервере (тот же приём
// resolveEmoji, что и у игровых ролей в gameNews/games.js) — по образцу
// того, как это сделано у официального бота VALORANT СНГ.
const PALETTE = [
    { key: 'red', name: 'Красный', hex: 0xed4245, emoji: '🔴', customEmojiName: 'color_red' },
    { key: 'orange', name: 'Оранжевый', hex: 0xe67e22, emoji: '🟠', customEmojiName: 'color_orange' },
    { key: 'yellow', name: 'Жёлтый', hex: 0xf1c40f, emoji: '🟡', customEmojiName: 'color_yellow' },
    { key: 'green', name: 'Зелёный', hex: 0x2ecc71, emoji: '🟢', customEmojiName: 'color_green' },
    { key: 'blue', name: 'Синий', hex: 0x3498db, emoji: '🔵', customEmojiName: 'color_blue' },
    { key: 'purple', name: 'Фиолетовый', hex: 0x9b59b6, emoji: '🟣', customEmojiName: 'color_purple' },
    { key: 'brown', name: 'Коричневый', hex: 0x8b5e3c, emoji: '🟤', customEmojiName: 'color_brown' },
    { key: 'black', name: 'Чёрный', hex: 0x23272a, emoji: '⚫', customEmojiName: 'color_black' },
    { key: 'white', name: 'Белый', hex: 0xf2f3f5, emoji: '⚪', customEmojiName: 'color_white' },
];

function roleName(color) {
    return `Цвет: ${color.name}`;
}

module.exports = { PALETTE, roleName };
