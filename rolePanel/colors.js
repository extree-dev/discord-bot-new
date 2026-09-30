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
const PALETTE = [
    { key: 'red', name: 'Красный', hex: 0xed4245, emoji: '🔴' },
    { key: 'orange', name: 'Оранжевый', hex: 0xe67e22, emoji: '🟠' },
    { key: 'yellow', name: 'Жёлтый', hex: 0xf1c40f, emoji: '🟡' },
    { key: 'green', name: 'Зелёный', hex: 0x2ecc71, emoji: '🟢' },
    { key: 'blue', name: 'Синий', hex: 0x3498db, emoji: '🔵' },
    { key: 'purple', name: 'Фиолетовый', hex: 0x9b59b6, emoji: '🟣' },
    { key: 'brown', name: 'Коричневый', hex: 0x8b5e3c, emoji: '🟤' },
    { key: 'black', name: 'Чёрный', hex: 0x23272a, emoji: '⚫' },
    { key: 'white', name: 'Белый', hex: 0xf2f3f5, emoji: '⚪' },
];

function roleName(color) {
    return `Цвет: ${color.name}`;
}

module.exports = { PALETTE, roleName };
