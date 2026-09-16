const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'temp-voice.json');

const DEFAULTS = {
    triggerChannelId: null,
    categoryId: null,
    controlChannelId: null,
    defaultLimit: 5,
    channels: {},
};

function ensureFile() {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(DEFAULTS, null, 2));
}

function load() {
    ensureFile();
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { ...DEFAULTS, ...data, channels: { ...data.channels } };
}

function save(config) {
    ensureFile();
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}

module.exports = { load, save, filePath };
