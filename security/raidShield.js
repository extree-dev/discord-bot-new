const { EmbedBuilder, GuildVerificationLevel } = require('discord.js');
const { load } = require('./config');
const { log, alertOwner } = require('./logger');

const joinTimestamps = new Map();
const lockdownUntil = new Map();
const previousVerification = new Map();

function isLockedDown(guildId) {
    const until = lockdownUntil.get(guildId);
    return Boolean(until && Date.now() < until);
}

async function triggerLockdown(guild, config, joinCount) {
    lockdownUntil.set(guild.id, Date.now() + config.raidShield.lockdownMs);

    try {
        if (!previousVerification.has(guild.id)) {
            previousVerification.set(guild.id, guild.verificationLevel);
        }
        await guild.setVerificationLevel(GuildVerificationLevel.VeryHigh, 'Raid shield: аномальный всплеск заходов');
    } catch (err) {
        console.error('raidShield: не удалось поднять verification level:', err.message);
    }

    await log(
        guild,
        new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🚨 Raid shield активирован')
            .setDescription(
                `За последние ${config.raidShield.windowMs / 1000} сек. зашло ${joinCount} участников.\n` +
                    `Уровень верификации поднят до максимума на ${Math.round(config.raidShield.lockdownMs / 60000)} мин.`
            )
            .setTimestamp()
    );
    await alertOwner(
        guild,
        'Raid shield сработал',
        `На сервере **${guild.name}**: ${joinCount} заходов за ${config.raidShield.windowMs / 1000} сек. Сервер временно в режиме максимальной верификации.`
    );

    setTimeout(async () => {
        try {
            const original = previousVerification.get(guild.id) ?? GuildVerificationLevel.None;
            await guild.setVerificationLevel(original, 'Raid shield: окончание рейд-режима');
            previousVerification.delete(guild.id);
            await log(
                guild,
                new EmbedBuilder()
                    .setColor(0x00cc66)
                    .setTitle('✅ Raid shield снят, уровень верификации восстановлен')
                    .setTimestamp()
            );
        } catch (err) {
            console.error('raidShield: не удалось вернуть verification level:', err.message);
        }
    }, config.raidShield.lockdownMs);
}

async function handleJoin(member) {
    const config = await load();
    if (!config.raidShield.enabled) return;
    const guild = member.guild;

    if (isLockedDown(guild.id) && config.raidShield.kickNewAccounts) {
        const age = Date.now() - member.user.createdTimestamp;
        if (age < config.raidShield.newAccountAgeMs) {
            await member.kick('Raid shield: новый аккаунт во время рейд-режима').catch(() => {});
            await log(
                guild,
                new EmbedBuilder()
                    .setColor(0xff8800)
                    .setTitle('🛡️ Raid shield: кикнут новый аккаунт')
                    .addFields(
                        { name: 'Участник', value: `${member.user.tag} (${member.id})` },
                        { name: 'Возраст аккаунта', value: `${Math.round(age / 3600000)} ч.` }
                    )
                    .setTimestamp()
            );
            return;
        }
    }

    const arr = (joinTimestamps.get(guild.id) ?? []).filter(ts => Date.now() - ts <= config.raidShield.windowMs);
    arr.push(Date.now());
    joinTimestamps.set(guild.id, arr);

    if (arr.length >= config.raidShield.joinThreshold && !isLockedDown(guild.id)) {
        await triggerLockdown(guild, config, arr.length);
    }
}

function register(client) {
    client.on('guildMemberAdd', member => handleJoin(member).catch(err => console.error('raidShield:', err)));
}

module.exports = { register };
