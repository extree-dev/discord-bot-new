const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'warnings.json');

function ensureFile() {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '{}');
}

function readAll() {
    ensureFile();
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeAll(data) {
    ensureFile();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function addWarning(guildId, userId, reason, moderatorTag) {
    const data = readAll();
    const key = `${guildId}_${userId}`;
    if (!data[key]) data[key] = [];
    data[key].push({ reason, moderatorTag, date: new Date().toISOString() });
    writeAll(data);
    return data[key];
}

function getWarnings(guildId, userId) {
    const data = readAll();
    return data[`${guildId}_${userId}`] ?? [];
}

function clearWarnings(guildId, userId) {
    const data = readAll();
    delete data[`${guildId}_${userId}`];
    writeAll(data);
}

module.exports = { addWarning, getWarnings, clearWarnings, filePath };
