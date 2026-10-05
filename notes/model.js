// Заметки модерации на участника — не наказание (в отличие от /warn),
// не видны самому участнику (/mycase их не показывает), просто контекст
// для стаффа между сменами ("предупреждён устно в войсе", "проверить при
// следующем нарушении"). Та же структура стора, что у utils/warnings.js.
const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'modNotes';
const store = createStore(STORE_NAME, {});

function key(guildId, userId) {
    return `${guildId}_${userId}`;
}

async function addNote(guildId, userId, text, authorTag) {
    const k = key(guildId, userId);
    return store.update(data => {
        if (!data[k]) data[k] = [];
        data[k].push({ text, authorTag, date: new Date().toISOString() });
        return data[k];
    });
}

async function getNotes(guildId, userId) {
    const data = await store.load();
    return data[key(guildId, userId)] ?? [];
}

// index — 1-based, как показывает /note list (человеку привычнее считать
// с единицы, а не с нуля).
async function removeNote(guildId, userId, index) {
    const k = key(guildId, userId);
    return store.update(data => {
        const list = data[k] ?? [];
        if (index < 1 || index > list.length) return { removed: false };
        const [note] = list.splice(index - 1, 1);
        if (list.length === 0) delete data[k];
        else data[k] = list;
        return { removed: true, note };
    });
}

module.exports = { addNote, getNotes, removeNote, storeName: STORE_NAME };
