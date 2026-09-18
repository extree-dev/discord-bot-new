const config = require('./config');
const model = require('./model');

// Публичный API фичи changelog/. Команда /changelog и scripts/setup-changelog.js
// обращаются только сюда, а не к changelog/config.js или changelog/model.js напрямую.
module.exports = {
    register: client => {
        model.checkAndAnnounce(client).catch(err => console.error('changelog:', err));
    },
    getLatestEntries: model.getLatestEntries,
    getEntry: model.getEntry,
    buildChangelogSummary: model.buildChangelogSummary,
    getConfig: config.load,
    saveChannel: async channelId => {
        await config.update(cfg => {
            cfg.channelId = channelId;
        });
    },
};
