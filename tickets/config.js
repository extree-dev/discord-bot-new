const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'tickets.json');

const DEFAULTS = {
    categoryId: null,
    panelChannelId: null,
    logChannelId: null,
    supportRoleId: null,
    counter: 0,
    tickets: {},
};

function ensureFile() {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(DEFAULTS, null, 2));
}

function load() {
    ensureFile();
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { ...DEFAULTS, ...data, tickets: { ...data.tickets } };
}

function save(config) {
    ensureFile();
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}

module.exports = { load, save, filePath };
