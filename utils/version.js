const { version, name } = require('../package.json');

function getVersion() {
    return version;
}

function getAppName() {
    return name;
}

function formatUptime(totalSeconds) {
    const seconds = Math.floor(totalSeconds);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days) parts.push(`${days} д.`);
    if (hours) parts.push(`${hours} ч.`);
    parts.push(`${minutes} мин.`);
    return parts.join(' ');
}

module.exports = { getVersion, getAppName, formatUptime };
