const fs = require('fs');
const path = require('path');

// Про каждый JSON-файл конфигурации бота (security-config.json,
// tickets.json, temp-voice.json) до этого момента работали по схеме
// load() -> мутация в памяти -> save(). Если между load() и save()
// одного вызова оказывался await (запрос к Discord API, чтение логов
// и т.д.), а в это время другой обработчик успевал сделать свой
// load()+save(), более поздняя запись полностью перезатирала файл —
// изменения первого вызова терялись (классическая гонка
// read-modify-write). Этот модуль даёт общий примитив, который
// исключает такую гонку.

// Очередь промисов на каждый файл — гарантирует, что для одного и
// того же файла операции update()/save() никогда не выполняются
// параллельно, даже если mutate() внутри update() делает await.
const queues = new Map();

function enqueue(filePath, task) {
    const previous = queues.get(filePath) ?? Promise.resolve();
    const run = previous.then(task, task);
    // Не даём одной упавшей задаче навсегда заблокировать очередь файла.
    queues.set(filePath, run.catch(() => {}));
    return run;
}

function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonSync(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Атомарная запись: пишем во временный файл рядом и переименовываем.
// Переименование внутри одной ФС гарантированно атомарно на уровне ОС,
// поэтому при падении процесса/контейнера посередине записи основной
// файл никогда не окажется наполовину записанным или пустым.
function writeJsonAtomicSync(filePath, data) {
    ensureDir(filePath);
    const tmpPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, filePath);
}

function ensureFileSync(filePath, defaults) {
    ensureDir(filePath);
    if (!fs.existsSync(filePath)) writeJsonAtomicSync(filePath, defaults);
}

/**
 * Создаёт обёртку над JSON-файлом конфигурации.
 *
 * @param {string} filePath - абсолютный путь к файлу.
 * @param {object} defaults - значения по умолчанию для нового файла.
 * @param {(raw: object) => object} normalize - объединяет прочитанные
 *   данные с defaults (глубоко, если есть вложенные объекты).
 */
function createStore(filePath, defaults, normalize = data => ({ ...defaults, ...data })) {
    function load() {
        ensureFileSync(filePath, defaults);
        return normalize(readJsonSync(filePath));
    }

    // Оставлен для обратной совместимости с местами, где load()+save()
    // выполняются без await между ними (тогда гонка невозможна). Сама
    // запись теперь атомарна и сериализована по файлу, но НЕ перечитывает
    // файл перед записью — если нужна защита от гонки, используйте update().
    function save(config) {
        return enqueue(filePath, () => writeJsonAtomicSync(filePath, config));
    }

    /**
     * Безопасный read-modify-write: весь цикл "прочитать свежие данные
     * -> дать mutate() их изменить (можно с await) -> записать" ставится
     * в очередь конкретного файла, поэтому конкурентные update()/save()
     * над одним файлом никогда не перекрывают друг друга.
     *
     * mutate(config) может мутировать объект напрямую и/или вернуть
     * значение — это значение становится результатом update().
     */
    function update(mutate) {
        return enqueue(filePath, async () => {
            const config = load();
            const result = await mutate(config);
            writeJsonAtomicSync(filePath, config);
            return result;
        });
    }

    return { load, save, update, filePath };
}

module.exports = { createStore, readJsonSync, writeJsonAtomicSync, ensureFileSync };
