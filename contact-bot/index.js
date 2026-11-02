// Отдельный процесс (см. docker-compose.yml, сервис contact-bot) —
// пересылает личные сообщения боту (TELEGRAM_BOT_TOKEN, тот же бот, что
// уже используется для Telegram Login Widget в dashboard/server.js —
// одно не мешает другому: виджет только проверяет подпись токеном,
// апдейты не читает) в личку владельцу (TELEGRAM_ADMIN_CHAT_ID). Ответ
// владельца реплаем на пересланное сообщение уходит обратно отправителю.
// Long polling, не вебхук — не требует домена/Caddy, сайт этот бот
// никак не трогает.
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

if (!token || !adminChatId) {
    console.error('contact-bot: TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_ID обязательны — процесс не запущен.');
    process.exit(1);
}

const autoReply = process.env.TELEGRAM_CONTACT_AUTOREPLY || 'Спасибо за сообщение! Отвечу, как только смогу.';

// Карта «ID пересланного в чате владельца сообщения» → «chat_id
// отправителя» — нужна, чтобы реплай владельца знал, кому отвечать.
// Переживает рестарт контейнера (volume contact-bot-data), растёт
// неограниченно долго при обычной нагрузке — оставлен простой JSON,
// при необходимости чистить вручную.
const STATE_FILE = path.join(__dirname, 'data', 'reply-map.json');
let replyMap = {};
try {
    replyMap = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
} catch (_err) {
    replyMap = {};
}

function saveReplyMap() {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(replyMap));
}

const bot = new TelegramBot(token, { polling: true });

function senderLabel(from) {
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
    const username = from.username ? `@${from.username}` : 'без username';
    return `${name} (${username}, id ${from.id})`;
}

bot.on('message', async msg => {
    const chatId = String(msg.chat.id);

    if (chatId === String(adminChatId)) {
        const repliedId = msg.reply_to_message?.message_id;
        const targetChatId = repliedId && replyMap[repliedId];
        if (targetChatId && msg.text) {
            await bot.sendMessage(targetChatId, msg.text).catch(err => {
                bot.sendMessage(adminChatId, `Не удалось доставить ответ: ${err.message}`);
            });
        }
        return;
    }

    if (msg.text === '/start') {
        await bot.sendMessage(chatId, autoReply);
        return;
    }

    const forwarded = await bot.forwardMessage(adminChatId, chatId, msg.message_id);
    replyMap[forwarded.message_id] = chatId;
    saveReplyMap();
    await bot.sendMessage(adminChatId, `От: ${senderLabel(msg.from)}`, {
        reply_to_message_id: forwarded.message_id,
    });
    await bot.sendMessage(chatId, autoReply);
});

bot.on('polling_error', err => console.error('contact-bot polling error:', err.message));

console.log('contact-bot: запущен, слушаю сообщения long polling.');
