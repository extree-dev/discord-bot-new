const fs = require('fs');
const path = require('path');

// Слэш-команды разложены по подпапкам commands/<категория>/ (moderation,
// general, ...) — сканируем их все, а не одну зашитую папку, чтобы
// добавление новой категории команд не требовало правки index.js и
// deploy-commands.js (Open/Closed: новая категория — это только новая
// папка с файлами команд).
function loadCommands() {
    const commandsRoot = path.join(__dirname, '..', 'commands');
    const categories = fs.readdirSync(commandsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory());

    const commands = [];
    for (const category of categories) {
        const categoryPath = path.join(commandsRoot, category.name);
        const files = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
        for (const file of files) {
            commands.push(require(path.join(categoryPath, file)));
        }
    }
    return commands;
}

module.exports = { loadCommands };
