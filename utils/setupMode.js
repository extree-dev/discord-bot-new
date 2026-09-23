// Два режима scripts/setup-*.js.
//
// По умолчанию (так их гоняет каждый деплой, .github/workflows/deploy.yml) —
// синхронизация: скрипт только находит уже существующие на сервере каналы
// и роли (по сохранённому ID, иначе по имени), записывает их ID в конфиг и
// обновляет собственные сообщения-панели бота. Ничего не создаёт, не
// удаляет, не переименовывает, не двигает и не переставляет права — всё,
// что администратор настроил на сервере руками, деплой не трогает.
//
// С флагом --bootstrap (только вручную, для первичной настройки):
//   docker compose run --rm bot node scripts/setup-X.js --bootstrap
// скрипт создаёт недостающее и выставляет права/позиции по умолчанию.
const path = require('path');
const { findChannel, findOrCreateChannel, findRole, findOrCreateRole } = require('./idempotent');

const BOOTSTRAP = process.argv.includes('--bootstrap');

function isBootstrap() {
    return BOOTSTRAP;
}

function bootstrapHint() {
    const script = process.argv[1] ? path.relative(process.cwd(), process.argv[1]) : 'scripts/setup-*.js';
    return `Создать вручную или запустить: docker compose run --rm bot node ${script} --bootstrap`;
}

// what — готовая фраза вида 'Канал "правила" не найден'.
function warnMissing(what) {
    console.warn(`${what} — деплой ничего не создаёт. ${bootstrapHint()}`);
}

async function ensureChannel(options) {
    if (BOOTSTRAP) return findOrCreateChannel(options);
    const channel = await findChannel(options);
    if (!channel) warnMissing(`Канал "${options.name}" не найден`);
    return { channel, created: false };
}

async function ensureRole(options) {
    if (BOOTSTRAP) return findOrCreateRole(options);
    const role = findRole(options);
    if (!role) warnMissing(`Роль "${options.name}" не найдена`);
    return { role, created: false };
}

// Сообщение-панель бота (последние 10 сообщений канала, автор — бот, есть
// компоненты): существующую обновляем всегда — это собственный контент
// бота, иначе новые кнопки/тексты из кода не дойдут до сервера; новую
// отправляем только в режиме --bootstrap.
async function refreshPanel({ channel, botId, payload, label }) {
    const messages = await channel.messages.fetch({ limit: 10 });
    const existing = messages.find(m => m.author.id === botId && m.components.length > 0);
    if (existing) {
        await existing.edit(payload);
        console.log(`${label}: панель обновлена.`);
        return existing;
    }
    if (BOOTSTRAP) {
        const sent = await channel.send(payload);
        console.log(`${label}: панель отправлена.`);
        return sent;
    }
    console.warn(
        `${label}: панель не найдена в канале "${channel.name}" — деплой новые сообщения не отправляет. ${bootstrapHint()}`
    );
    return null;
}

module.exports = { isBootstrap, ensureChannel, ensureRole, refreshPanel, warnMissing };
