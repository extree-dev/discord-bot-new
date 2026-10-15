// Рендерит HTML-письмо верификации в файл для просмотра в браузере.
// Ничего не отправляет. Запуск:
//   node scripts/preview-email.js variant1
//   node scripts/preview-email.js variant2
//   node scripts/preview-email.js variant3
// Результат — preview-email.html в корне проекта.

const fs = require('fs');
const path = require('path');
const { renderVerificationEmail } = require('../utils/email');

const variant = process.argv[2] ?? 'variant1';

const html = renderVerificationEmail({
    code: '943454',
    username: 'Extree',
    guildName: 'Extree Community',
    variant,
});

const outPath = path.join(__dirname, '..', 'preview-email.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`Вариант: ${variant}`);
console.log(`Готово: ${outPath}`);
console.log('Открой файл в браузере.');