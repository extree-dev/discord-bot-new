// Единый номер дела по наказаниям — сейчас warn/mute/ban/kick каждый
// живут в своём сторе (utils/warnings.js, moderation/model.js, нативный
// бан Discord без собственного хранения вообще) без общего ID. Этот
// журнал — чисто аддитивный лог для /case: он НЕ заменяет те сторы и не
// участвует в их логике (decay/escalation/sweep продолжают работать как
// были, читая свои собственные данные) — только фиксирует, что и когда
// произошло, под одним сквозным номером, для разбора позже.
const { createStore } = require('../utils/pgStore');

const STORE_NAME = 'cases';
const store = createStore(STORE_NAME, {});

// update() — не load()+save(): два наказания почти одновременно (ручное
// и, в будущем, automod) не должны получить один и тот же номер дела.
async function addCase(guildId, type, data) {
    return store.update(stored => {
        const guildCases = stored[guildId] ?? { nextId: 1, cases: {} };
        const id = guildCases.nextId;
        guildCases.cases[id] = { id, type, createdAt: new Date().toISOString(), ...data };
        guildCases.nextId = id + 1;
        stored[guildId] = guildCases;
        return id;
    });
}

async function getCase(guildId, id) {
    const stored = await store.load();
    return stored[guildId]?.cases?.[id] ?? null;
}

// limit — показываем самые НЕДАВНИЕ дела первыми, не всю историю разом:
// у частого нарушителя список иначе быстро выйдет за предел длины embed.
async function getCasesForUser(guildId, targetId, limit = 10) {
    const stored = await store.load();
    const all = Object.values(stored[guildId]?.cases ?? {});
    return all
        .filter(c => c.targetId === targetId)
        .sort((a, b) => b.id - a.id)
        .slice(0, limit);
}

module.exports = { addCase, getCase, getCasesForUser, storeName: STORE_NAME };
