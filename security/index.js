const antiNuke = require('./antiNuke');
const raidShield = require('./raidShield');
const auditLog = require('./auditLog');
const automod = require('./automod');
const verification = require('./verification');
const { scheduleAutoBackup } = require('./backup');

function register(client) {
    antiNuke.register(client);
    raidShield.register(client);
    auditLog.register(client);
    automod.register(client);
    verification.register(client);
    scheduleAutoBackup(client);
    console.log('Система безопасности активирована (anti-nuke, raid shield, audit log, automod, верификация, автобэкап).');
}

module.exports = {
    register,
    handleVerifyButton: verification.handleButton,
    handleVerifyModal: verification.handleModalSubmit,
};
