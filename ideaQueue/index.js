const handlers = require('./handlers');
const config = require('./config');

// Публичный API фичи ideaQueue/. scripts/setup-idea-queue.js обращается
// только сюда, а не к ideaQueue/config.js напрямую.
module.exports = {
    register: handlers.register,
    handleButton: handlers.handleButton,
    getConfig: config.load,
    updateConfig: config.update,
};
