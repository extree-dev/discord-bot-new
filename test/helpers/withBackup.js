const fs = require('fs');

// Тесты для config/warnings-модулей пишут в те же data/*.json файлы,
// которыми пользуется реальный бот (пути в этих модулях зашиты
// относительно __dirname, подменить их без правки исходников нельзя).
// В CI data/ создаётся заново на пустом чекауте, но на машине
// разработчика там могут быть настоящие настройки сервера — поэтому
// withBackup() сохраняет исходное содержимое файла перед тестом и
// восстанавливает его после, даже если тест упал.
async function withBackup(filePath, fn) {
    const existed = fs.existsSync(filePath);
    const original = existed ? fs.readFileSync(filePath, 'utf8') : null;
    try {
        await fn();
    } finally {
        if (existed) {
            fs.writeFileSync(filePath, original);
        } else if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

module.exports = { withBackup };
