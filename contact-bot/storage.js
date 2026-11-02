// Общее состояние contact-bot (index.js — long polling, webapp-server.js —
// Mini App API) — один JSON-файл на volume contact-bot-data, оба модуля
// требуют этот же синглтон, так что правки видны сразу в обоих местах.
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'data', 'state.json');
// Срез истории на один диалог — защищает файл от неограниченного роста,
// Mini App всё равно показывает только последние сообщения.
const HISTORY_LIMIT_PER_CHAT = 200;
const PROCESSED_IDS_LIMIT = 500;

let state = { replyMap: {}, processedIds: [], blocked: [], conversations: {} };
try {
    state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
} catch (_err) {
    // первый запуск — файла ещё нет
}

const processedIds = new Set(state.processedIds);
const blocked = new Set(state.blocked);

function save() {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(
        STATE_FILE,
        JSON.stringify({
            replyMap: state.replyMap,
            processedIds: [...processedIds].slice(-PROCESSED_IDS_LIMIT),
            blocked: [...blocked],
            conversations: state.conversations,
        })
    );
}

function markProcessed(key) {
    if (processedIds.has(key)) return false;
    processedIds.add(key);
    return true;
}

function getOrCreateConversation(chatId) {
    return (state.conversations[chatId] ||= {
        chatId,
        name: '',
        username: '',
        messages: [],
        resolved: false,
        lastActivity: null,
    });
}

function setSenderInfo(chatId, { name, username }) {
    const convo = getOrCreateConversation(chatId);
    convo.name = name;
    convo.username = username;
    save();
}

function recordMessage(chatId, entry) {
    const convo = getOrCreateConversation(chatId);
    convo.messages.push(entry);
    if (convo.messages.length > HISTORY_LIMIT_PER_CHAT) {
        convo.messages.splice(0, convo.messages.length - HISTORY_LIMIT_PER_CHAT);
    }
    convo.lastActivity = entry.at;
    if (entry.direction === 'in') convo.resolved = false;
    save();
}

function setResolved(chatId, resolved) {
    const convo = getOrCreateConversation(chatId);
    convo.resolved = resolved;
    save();
}

function listConversations() {
    return Object.values(state.conversations)
        .map(c => ({
            chatId: c.chatId,
            name: c.name,
            username: c.username,
            lastActivity: c.lastActivity,
            lastMessage: c.messages[c.messages.length - 1]?.text || '',
            resolved: c.resolved,
            blocked: blocked.has(c.chatId),
        }))
        .sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''));
}

function getConversation(chatId) {
    const convo = state.conversations[chatId];
    if (!convo) return null;
    return { ...convo, blocked: blocked.has(chatId) };
}

function block(chatId) {
    blocked.add(chatId);
    save();
}
function unblock(chatId) {
    blocked.delete(chatId);
    save();
}
function isBlocked(chatId) {
    return blocked.has(chatId);
}

function setReplyTarget(messageId, chatId) {
    state.replyMap[messageId] = chatId;
    save();
}
function getReplyTarget(messageId) {
    return state.replyMap[messageId];
}

module.exports = {
    markProcessed,
    setSenderInfo,
    recordMessage,
    setResolved,
    listConversations,
    getConversation,
    block,
    unblock,
    isBlocked,
    setReplyTarget,
    getReplyTarget,
};
