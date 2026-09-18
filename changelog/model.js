// Доменный слой "что нового": парсит CHANGELOG.md в структурированные
// записи по версии и строит из них сообщение — как разовую карточку
// анонса при старте на новой версии, так и сводку для /changelog.
// Чистые функции парсинга (parseChangelog/getEntry/getLatestEntries) не
// трогают Discord API и покрыты тестом отдельно от checkAndAnnounce.
const fs = require('fs');
const path = require('path');
const { COLORS, formatBody } = require('../utils/embeds');
const { baseContainer, textDisplay, separator, toMessage } = require('../utils/components');
const { getVersion } = require('../utils/version');
const config = require('./config');

const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');

function readChangelogFile() {
    return fs.readFileSync(CHANGELOG_PATH, 'utf8');
}

// CHANGELOG.md следует формату Keep a Changelog: "## [версия] — заголовок"
// делит файл на секции, весь текст до следующего такого заголовка — тело
// секции. "[Unreleased]" — черновик, а не опубликованный релиз, поэтому
// исключается: анонсировать пользователям ещё не выпущенную версию нет
// смысла. Секции идут в порядке файла — по конвенции Keep a Changelog
// это новейшая версия сверху, поэтому результат уже отсортирован от
// новых к старым.
function parseChangelog(text = readChangelogFile()) {
    // /\r?\n/, а не просто '\n' — на CRLF ('\r\n') "$" в регулярке ниже не
    // матчится перед висящим "\r" в конце строки, и весь парсинг молча
    // возвращает пустой список секций (без единой ошибки).
    const lines = text.split(/\r?\n/);
    const sections = [];
    let current = null;

    for (const line of lines) {
        const match = /^##\s+\[([^\]]+)\]\s*(.*)$/.exec(line);
        if (match) {
            if (current) sections.push(current);
            current = { version: match[1].trim(), title: match[2].replace(/^[—-]\s*/, '').trim(), lines: [] };
            continue;
        }
        if (current) current.lines.push(line);
    }
    if (current) sections.push(current);

    return sections
        .filter(s => s.version.toLowerCase() !== 'unreleased')
        .map(s => ({ version: s.version, title: s.title, body: s.lines.join('\n').trim() }));
}

// По SemVer PATCH (третье число) — багфикс, не новая функциональность;
// анонс "что нового" в канал имеет смысл только для релизов (MINOR/MAJOR,
// PATCH === 0) — иначе каждое мелкое исправление превращается в отдельный
// пост, и участники перестают отличать релиз от рядового патча. Полная
// история версий, включая патчи, всё равно остаётся в CHANGELOG.md и
// видна через /changelog — от анонса освобождены только автопосты.
function isReleaseVersion(version) {
    const parts = version.split('.').map(Number);
    return parts[2] === 0;
}

// text — опциональный аргумент только для тестов (см. test/changelog.test.js):
// в проде вызывается без него, тогда parseChangelog() сам читает CHANGELOG.md.
function getEntry(version, text) {
    return parseChangelog(text).find(s => s.version === version) ?? null;
}

function getLatestEntries(limit = 3, text) {
    return parseChangelog(text).slice(0, limit);
}

// Discord ограничивает TextDisplay 4000 символами — тело секции почти
// никогда не подходит настолько близко к лимиту, но на всякий случай
// подрезаем, а не даём упасть send()/reply() с ошибкой формы.
const MAX_BODY_LENGTH = 3500;

function addEntryBlocks(container, entry) {
    const heading = entry.title ? `v${entry.version} — ${entry.title}` : `v${entry.version}`;
    container.addTextDisplayComponents(textDisplay(formatBody(heading)));
    if (entry.body) {
        container.addTextDisplayComponents(textDisplay(entry.body.slice(0, MAX_BODY_LENGTH)));
    }
    return container;
}

// Карточка одной версии — для авто-анонса на старте.
function buildAnnounceCard(entry) {
    const container = baseContainer(COLORS.primary).addTextDisplayComponents(
        textDisplay(formatBody('Что нового', 'Вышло обновление бота'))
    );
    container.addSeparatorComponents(separator());
    addEntryBlocks(container, entry);
    return container;
}

// Сводка нескольких версий подряд, разделённых Separator — для /changelog.
function buildChangelogSummary(entries) {
    const container = baseContainer(COLORS.primary);
    entries.forEach((entry, i) => {
        addEntryBlocks(container, entry);
        if (i < entries.length - 1) container.addSeparatorComponents(separator());
    });
    return container;
}

// Публикует карточку в настроенный канал, если текущая версия бота ещё
// не была анонсирована и для неё есть запись в CHANGELOG.md. Молча
// ничего не делает (ждёт следующего перезапуска), если канал не настроен
// или запись пока не добавлена — не отмечает версию как объявленную,
// чтобы релиз не потерялся молча, если о канале/записи забыли. Патч-версии
// (см. isReleaseVersion) отмечаются как обработанные сразу, без попытки
// публикации — это осознанный пропуск, а не забытая настройка.
async function checkAndAnnounce(client) {
    const currentVersion = getVersion();
    const cfg = await config.load();
    if (cfg.lastAnnouncedVersion === currentVersion) return;

    if (!isReleaseVersion(currentVersion)) {
        await config.update(c => {
            c.lastAnnouncedVersion = currentVersion;
        });
        return;
    }

    const entry = getEntry(currentVersion);
    if (!cfg.channelId || !entry) return;

    const channel =
        client.channels.cache.get(cfg.channelId) ?? (await client.channels.fetch(cfg.channelId).catch(() => null));
    if (!channel) return;

    await channel.send(toMessage(buildAnnounceCard(entry))).catch(() => {});
    await config.update(c => {
        c.lastAnnouncedVersion = currentVersion;
    });
}

module.exports = {
    parseChangelog,
    isReleaseVersion,
    getEntry,
    getLatestEntries,
    buildAnnounceCard,
    buildChangelogSummary,
    checkAndAnnounce,
};
