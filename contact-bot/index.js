// Отдельный процесс (см. docker-compose.yml, сервис contact-bot) —
// принимает личные сообщения боту (TELEGRAM_BOT_TOKEN, тот же бот, что
// уже используется для Telegram Login Widget в dashboard/server.js —
// одно не мешает другому: виджет только проверяет подпись токеном,
// апдейты не читает) и пересылает в личку владельцу (TELEGRAM_ADMIN_CHAT_ID)
// одним сообщением-карточкой от имени бота (без нативного Telegram-
// форварда — тот подписывает "Переслано от ..." и ссылается на профиль
// отправителя) с кнопками "Заблокировать"/"Решено". Ответ владельца
// реплаем на карточку уходит обратно отправителю. Та же история диалогов
// доступна через Mini App (webapp-server.js, contact.extree.tech).
// Long polling, не вебхук — домен/Caddy нужны только самому Mini App.
const TelegramBot = require('node-telegram-bot-api');
const storage = require('./storage');
const { createWebAppServer, setAdminMenuButton } = require('./webapp-server');

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
const rateLimitHits = new Map();
function isRateLimited(chatId) {
    const now = Date.now();
    const hits = (rateLimitHits.get(chatId) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    hits.push(now);
    rateLimitHits.set(chatId, hits);
    return hits.length > RATE_LIMIT_COUNT;
}

const bot = new TelegramBot(token, { polling: true });

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function senderLabel(from) {
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
    const username = from.username ? `@${from.username}` : 'без username';
    return `${name} (${username}, id ${from.id})`;
}

// Текстовое описание для истории Mini App — медиа мы не скачиваем и не
// храним, только короткую пометку, что именно прислали.
function describeMessage(msg) {
    if (msg.text) return msg.text;
    if (msg.photo) return `[фото]${msg.caption ? ' ' + msg.caption : ''}`;
    if (msg.video) return `[видео]${msg.caption ? ' ' + msg.caption : ''}`;
    if (msg.document) return `[файл: ${msg.document.file_name || '?'}]`;
    if (msg.voice) return '[голосовое]';
    if (msg.sticker) return `[стикер ${msg.sticker.emoji || ''}]`;
    return '[сообщение]';
}

function cardKeyboard(chatId, originalMessageId) {
    return {
        inline_keyboard: [
            [
                { text: '🚫 Заблокировать', callback_data: `block:${chatId}` },
                { text: '✅ Решено', callback_data: `done:${chatId}:${originalMessageId}` },
            ],
        ],
    };
}

async function relayToAdmin(msg, chatId) {
    const label = `<b>${escapeHtml(senderLabel(msg.from))}</b>`;
    const keyboard = cardKeyboard(chatId, msg.message_id);
    let sent;
    if (msg.text) {
        sent = await bot.sendMessage(adminChatId, `${label}:\n\n${escapeHtml(msg.text)}`, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
        });
    } else {
        try {
            sent = await bot.copyMessage(adminChatId, chatId, msg.message_id, {
                caption: label,
                parse_mode: 'HTML',
                reply_markup: keyboard,
            });
        } catch (_err) {
            // Не у всех типов сообщений (стикеры и т.п.) есть caption.
            sent = await bot.copyMessage(adminChatId, chatId, msg.message_id, { reply_markup: keyboard });
            await bot.sendMessage(adminChatId, label, { parse_mode: 'HTML', reply_to_message_id: sent.message_id });
        }
    }
    storage.setReplyTarget(sent.message_id, chatId);
    storage.setSenderInfo(chatId, {
        name: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' '),
        username: msg.from.username || '',
    });
    storage.recordMessage(chatId, { direction: 'in', text: describeMessage(msg), at: new Date().toISOString() });
}

// Node 20 по умолчанию завершает процесс на необработанном отклонении
// промиса — ошибка внутри обработчика (сеть, временная недоступность
// Telegram API, что угодно) иначе роняла бы весь бот, а рестарт заново
// получал бы от Telegram тот же неподтверждённый апдейт — дубли в чате
// владельца на каждом цикле падения (ровно так уже случилось один раз
// из-за прав на volume). handle() ловит и просто логирует.
function handle(fn) {
    return async (...args) => {
        try {
            await fn(...args);
        } catch (err) {
            console.error('contact-bot: ошибка в обработчике:', err);
        }
    };
}

bot.on(
    'message',
    handle(async msg => {
        const chatId = String(msg.chat.id);
        const updateKey = `msg:${chatId}:${msg.message_id}`;
        if (!storage.markProcessed(updateKey)) return;

        if (chatId === adminChatId) {
            const repliedId = msg.reply_to_message?.message_id;
            const targetChatId = repliedId && storage.getReplyTarget(repliedId);

            if (msg.text?.startsWith('/unblock')) {
                const id = msg.text.split(/\s+/)[1];
                if (id) {
                    storage.unblock(id);
                    await bot.sendMessage(adminChatId, `Разблокирован: ${id}`);
                } else {
                    await bot.sendMessage(adminChatId, 'Укажи id: /unblock <chat_id>');
                }
                return;
            }

            if (targetChatId && msg.text) {
                await bot
                    .sendMessage(targetChatId, msg.text)
                    .then(() => {
                        storage.recordMessage(targetChatId, {
                            direction: 'out',
                            text: msg.text,
                            at: new Date().toISOString(),
                        });
                    })
                    .catch(err => {
                        bot.sendMessage(adminChatId, `Не удалось доставить ответ (${targetChatId}): ${err.message}`);
                    });
            }
            return;
        }

        if (storage.isBlocked(chatId)) return;

        if (msg.text === '/start' || msg.text === '/help') {
            await bot.sendMessage(chatId, helpText);
            return;
        }

        if (isRateLimited(chatId)) return;

        await relayToAdmin(msg, chatId);
        await bot.sendMessage(chatId, autoReply);
    })
);

bot.on(
    'callback_query',
    handle(async query => {
        const updateKey = `cb:${query.id}`;
        if (!storage.markProcessed(updateKey)) return;

        const [action, chatId] = (query.data || '').split(':');
        if (action === 'block') {
            storage.block(chatId);
            await bot.answerCallbackQuery(query.id, { text: `Заблокирован: ${chatId}` });
            await bot.editMessageReplyMarkup(
                { inline_keyboard: [[{ text: '🚫 Заблокирован', callback_data: 'noop' }]] },
                { chat_id: adminChatId, message_id: query.message.message_id }
            );
            return;
        }
        if (action === 'done') {
            storage.setResolved(chatId, true);
            await bot.answerCallbackQuery(query.id, { text: 'Отмечено решённым' });
            await bot.editMessageReplyMarkup(
                { inline_keyboard: [[{ text: '✅ Решено', callback_data: 'noop' }]] },
                { chat_id: adminChatId, message_id: query.message.message_id }
            );
            return;
        }
        await bot.answerCallbackQuery(query.id);
    })
);

bot.on('polling_error', err => console.error('contact-bot polling error:', err.message));

const webAppPort = Number(process.env.CONTACT_BOT_WEBAPP_PORT || 8090);
createWebAppServer({ bot, token, adminChatId, storage, port: webAppPort });

const webAppUrl = process.env.CONTACT_BOT_WEBAPP_URL;
if (webAppUrl) {
    setAdminMenuButton({ token, adminChatId, url: webAppUrl }).catch(err =>
        console.error('contact-bot: не удалось настроить кнопку меню Mini App:', err.message)
    );
} else {
    console.log('contact-bot: CONTACT_BOT_WEBAPP_URL не задан — кнопка меню Mini App не настраивается автоматически.');
}

console.log('contact-bot: запущен, слушаю сообщения long polling.');
