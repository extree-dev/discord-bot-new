// Отдельный процесс (см. docker-compose.yml, сервис contact-bot) —
// принимает личные сообщения боту (TELEGRAM_BOT_TOKEN, тот же бот, что
// уже используется для Telegram Login Widget в dashboard/server.js —
// одно не мешает другому: виджет только проверяет подпись токеном,
// апдейты не читает) и пересылает в личку владельцу (TELEGRAM_ADMIN_CHAT_ID)
// одним сообщением от имени бота (без нативного Telegram-форварда — тот
// подписывает "Переслано от ..." и ссылается на профиль отправителя).
// Ответ владельца реплаем на это сообщение уходит обратно отправителю.
// Long polling, не вебхук — не требует домена/Caddy, сайт этот бот
// никак не трогает.
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '');

if (!token || !adminChatId) {
    console.error('contact-bot: TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_ID обязательны — процесс не запущен.');
    process.exit(1);
}

const autoReply = process.env.TELEGRAM_CONTACT_AUTOREPLY || 'Спасибо за сообщение! Отвечу, как только смогу.';
const helpText =
    'Это личка для связи с владельцем сайта — напиши сообщение, оно придёт ему напрямую, и он ответит здесь же.';

const RATE_LIMIT_COUNT = 8;
const RATE_LIMIT_WINDOW_MS = 60_000;
// Долго удерживающийся long polling после рестарта контейнера может
// получить от Telegram уже обработанный апдейт повторно (если процесс
// упал до следующего getUpdates, подтверждающего offset) — отсюда
// дубли автоответа/пересылки. PROCESSED_IDS_LIMIT ограничивает журнал,
// чтобы файл не рос бесконечно.
const PROCESSED_IDS_LIMIT = 500;

const STATE_FILE = path.join(__dirname, 'data', 'state.json');
let state = { replyMap: {}, processedIds: [], blocked: [] };
try {
    state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
} catch (_err) {
    // первый запуск — файла ещё нет, остаёмся с дефолтом
}
const processedIds = new Set(state.processedIds);
const blocked = new Set(state.blocked);

function saveState() {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(
        STATE_FILE,
        JSON.stringify({
            replyMap: state.replyMap,
            processedIds: [...processedIds].slice(-PROCESSED_IDS_LIMIT),
            blocked: [...blocked],
        })
    );
}

function markProcessed(updateKey) {
    if (processedIds.has(updateKey)) return false;
    processedIds.add(updateKey);
    return true;
}

const rateLimitHits = new Map();
function isRateLimited(chatId) {
    const now = Date.now();
    const hits = (rateLimitHits.get(chatId) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    hits.push(now);
    rateLimitHits.set(chatId, hits);
    return hits.length > RATE_LIMIT_COUNT;
}

const bot = new TelegramBot(token, { polling: true });

function senderLabel(from) {
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
    const username = from.username ? `@${from.username}` : 'без username';
    return `${name} (${username}, id ${from.id})`;
}

async function relayToAdmin(msg, chatId) {
    const label = `👤 ${senderLabel(msg.from)}`;
    let sent;
    if (msg.text) {
        sent = await bot.sendMessage(adminChatId, `${label}:\n\n${msg.text}`);
    } else {
        try {
            sent = await bot.copyMessage(adminChatId, chatId, msg.message_id, { caption: label });
        } catch (_err) {
            // Не у всех типов сообщений (стикеры и т.п.) есть caption —
            // копируем как есть и подпись шлём отдельной строкой.
            sent = await bot.copyMessage(adminChatId, chatId, msg.message_id);
            await bot.sendMessage(adminChatId, label, { reply_to_message_id: sent.message_id });
        }
    }
    state.replyMap[sent.message_id] = chatId;
    saveState();
}

bot.on('message', async msg => {
    const chatId = String(msg.chat.id);
    const updateKey = `${chatId}:${msg.message_id}`;
    if (!markProcessed(updateKey)) return;

    if (chatId === adminChatId) {
        const repliedId = msg.reply_to_message?.message_id;
        const targetChatId = repliedId && state.replyMap[repliedId];

        if (msg.text === '/block' && targetChatId) {
            blocked.add(targetChatId);
            saveState();
            await bot.sendMessage(adminChatId, `Заблокирован: ${targetChatId}`);
            return;
        }
        if (msg.text?.startsWith('/unblock')) {
            const id = msg.text.split(/\s+/)[1];
            if (id && blocked.delete(id)) {
                saveState();
                await bot.sendMessage(adminChatId, `Разблокирован: ${id}`);
            } else {
                await bot.sendMessage(adminChatId, 'Укажи id: /unblock <chat_id>');
            }
            return;
        }

        if (targetChatId && msg.text) {
            await bot.sendMessage(targetChatId, msg.text).catch(err => {
                bot.sendMessage(adminChatId, `Не удалось доставить ответ (${targetChatId}): ${err.message}`);
            });
        }
        return;
    }

    if (blocked.has(chatId)) return;

    if (msg.text === '/start' || msg.text === '/help') {
        await bot.sendMessage(chatId, helpText);
        return;
    }

    if (isRateLimited(chatId)) return;

    await relayToAdmin(msg, chatId);
    await bot.sendMessage(chatId, autoReply);
});

bot.on('polling_error', err => console.error('contact-bot polling error:', err.message));

console.log('contact-bot: запущен, слушаю сообщения long polling.');
