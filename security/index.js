const config = require('./config');
const backup = require('./backup');
const antiNuke = require('./antiNuke');
const raidShield = require('./raidShield');
const auditLog = require('./auditLog');
const automod = require('./automod');
const verification = require('./verification');
const lockdown = require('./lockdown');
const logger = require('./logger');

function register(client) {
    antiNuke.register(client);
    raidShield.register(client);
    auditLog.register(client);
    automod.register(client);
    verification.register(client);
    backup.scheduleAutoBackup(client);
    console.log(
        'Система безопасности активирована (anti-nuke, raid shield, audit log, automod, верификация, автобэкап).'
    );
}

// Публичный API фичи security/. Всё, что снаружи (команды модерации,
// scripts/setup-*.js) нужно от подсистемы безопасности, должно идти
// через этот файл, а не через прямые require('../security/config') или
// require('../security/backup') — иначе внутреннее устройство фичи
// нельзя будет поменять, не проверив вручную все внешние точки входа.
module.exports = {
    register,
    handleVerifyButton: verification.handleButton,
    handleVerifyModal: verification.handleModalSubmit,
    VERIFY_BUTTON_ID: verification.VERIFY_BUTTON_ID,
    getConfig: config.load,
    updateConfig: config.update,
    createBackup: backup.createBackup,
    listBackups: backup.listBackups,
    restoreBackup: backup.restoreBackup,
    activateLockdown: lockdown.activate,
    deactivateLockdown: lockdown.deactivate,
    log: logger.log,
};
