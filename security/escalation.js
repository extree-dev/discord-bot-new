// Единая эскалация наказаний по общему числу предупреждений участника —
// раньше пороги (3 предупреждения → тайм-аут, 5 → бан) жили только внутри
// automod.js (сам же automod и выдавал эти предупреждения) и никак не
// реагировали на предупреждения, выданные вручную через /warn. addWarning
// (utils/warnings.js) не различает источник — одна и та же история варнов
// у участника, поэтому и эскалация должна быть одна общая точка, а не
// дублироваться в automod.js и commands/moderation/warn.js по отдельности.
const { log } = require('./logger');
const { notifyPunishment } = require('../utils/punishmentNotice');
const { COLORS, baseEmbed, formatBody } = require('../utils/embeds');

const TIMEOUT_THRESHOLD = 3;
const TIMEOUT_MS = 10 * 60 * 1000;
const BAN_THRESHOLD = 5;

// source — короткая подпись, откуда пришли предупреждения ("Automod",
// "Накопленные предупреждения") — только для лога/аудит-причины, на саму
// логику эскалации не влияет: пороги считаются по общему числу варнов
// независимо от того, кто их выдавал.
async function applyWarningEscalation(guild, member, warningsCount, source) {
    if (!member) return null;

    if (warningsCount >= BAN_THRESHOLD && member.bannable) {
        await member.ban({ reason: `${source}: ${warningsCount}+ предупреждений` }).catch(() => {});
        await log(
            guild,
            baseEmbed(COLORS.critical).setDescription(
                formatBody(
                    'Автоэскалация: бан',
                    `${member.user.tag} (${member.id}) забанен автоматически — ${warningsCount} предупреждений (${source}).`
                )
            )
        );
        return { action: 'ban', warningsCount };
    }

    if (warningsCount >= TIMEOUT_THRESHOLD && member.moderatable) {
        await member.timeout(TIMEOUT_MS, `${source}: ${warningsCount}+ предупреждений`).catch(() => {});
        await notifyPunishment(member.user, guild, {
            kind: 'timeout',
            reason: `Автоматическая эскалация — ${warningsCount} предупреждений.`,
            durationLabel: '10 минут',
        });
        await log(
            guild,
            baseEmbed(COLORS.warning).setDescription(
                formatBody(
                    'Автоэскалация: тайм-аут',
                    `${member.user.tag} (${member.id}) замьючен на 10 минут автоматически — ${warningsCount} предупреждений (${source}).`
                )
            )
        );
        return { action: 'timeout', warningsCount, durationMs: TIMEOUT_MS };
    }

    return null;
}

module.exports = { applyWarningEscalation, TIMEOUT_THRESHOLD, TIMEOUT_MS, BAN_THRESHOLD };
