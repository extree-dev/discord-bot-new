// Ванильный JS, без сборки — страница маленькая, отдельный bundler не
// оправдан. Везде textContent, не innerHTML: текст сообщений приходит от
// посторонних людей через бота, вставлять его как HTML нельзя (XSS).
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
if (tg?.themeParams) {
    for (const [key, value] of Object.entries(tg.themeParams)) {
        document.documentElement.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, value);
    }
}

const initData = tg?.initData || '';

async function api(path, options = {}) {
    const res = await fetch(path, {
        ...options,
        headers: { ...options.headers, 'X-Telegram-Init-Data': initData, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
}

const listView = document.getElementById('list-view');
const listEl = document.getElementById('list');
const listEmpty = document.getElementById('list-empty');
const chatView = document.getElementById('chat-view');
const chatTitle = document.getElementById('chat-title');
const blockBtn = document.getElementById('block-btn');
const messagesEl = document.getElementById('messages');
const replyForm = document.getElementById('reply-form');
const replyText = document.getElementById('reply-text');

let currentChatId = null;

function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

async function renderList() {
    const conversations = await api('api/conversations');
    listEl.replaceChildren();
    listEmpty.hidden = conversations.length > 0;

    for (const c of conversations) {
        const row = el('div', 'convo-row');
        const top = el('div', 'top');
        top.appendChild(el('span', null, c.name || c.username || c.chatId));
        if (c.blocked) top.appendChild(el('span', 'badge blocked', 'блок'));
        else if (c.resolved) top.appendChild(el('span', 'badge resolved', 'решено'));
        row.appendChild(top);
        row.appendChild(el('div', 'preview', `${c.lastMessage} · ${formatTime(c.lastActivity)}`));
        row.addEventListener('click', () => openChat(c.chatId));
        listEl.appendChild(row);
    }
}

async function openChat(chatId) {
    const convo = await api(`api/conversations/${chatId}`);
    currentChatId = chatId;
    chatTitle.textContent = convo.name || convo.username || chatId;
    blockBtn.textContent = convo.blocked ? '✅ Разблок.' : '🚫 Блок';
    blockBtn.dataset.blocked = String(convo.blocked);

    messagesEl.replaceChildren();
    for (const m of convo.messages) {
        const bubble = el('div', `msg ${m.direction}`, m.text);
        messagesEl.appendChild(bubble);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;

    listView.hidden = true;
    chatView.hidden = false;
}

function closeChat() {
    currentChatId = null;
    chatView.hidden = true;
    listView.hidden = false;
    renderList().catch(console.error);
}

document.getElementById('back-btn').addEventListener('click', closeChat);

blockBtn.addEventListener('click', async () => {
    if (!currentChatId) return;
    const isBlocked = blockBtn.dataset.blocked === 'true';
    await api(`api/conversations/${currentChatId}/${isBlocked ? 'unblock' : 'block'}`, { method: 'POST' });
    openChat(currentChatId).catch(console.error);
});

replyForm.addEventListener('submit', async e => {
    e.preventDefault();
    const text = replyText.value.trim();
    if (!text || !currentChatId) return;
    replyText.value = '';
    await api(`api/conversations/${currentChatId}/reply`, { method: 'POST', body: JSON.stringify({ text }) });
    openChat(currentChatId).catch(console.error);
});

renderList().catch(err => {
    listEmpty.hidden = false;
    listEmpty.textContent = 'Не удалось загрузить: откройте панель через кнопку меню бота в Telegram.';
    console.error(err);
});
