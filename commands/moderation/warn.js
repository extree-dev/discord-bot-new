const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { addWarning, getActiveWarnings } = require('../../utils/warnings');
const { COLORS, baseEmbed, formatBody } = require('../../utils/embeds');
const { notifyPunishment } = require('../../utils/punishmentNotice');
const security = require('../../security');
const cases = require('../../cases');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Выдать предупреждение участнику')
        .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Причина').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        await addWarning(interaction.guild.id, target.id, reason, interaction.user.tag);
        const activeWarnings = await getActiveWarnings(interaction.guild.id, target.id);

        // Общая эскалация (3 предупреждения → тайм-аут, 5 → бан) — та же
        // функция, что использует automod, применяется к общему числу
        // варнов независимо от того, что они выданы вручную, а не
        // automod'ом (см. security/escalation.js). Считаются только
        // активные (не истёкшие по WARNING_DECAY_MS) варны — старые,
        // "сгоревшие" от давности не должны разом утянуть в бан за одно
        // новое нарушение.
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        const escalation = member
            ? await security.applyWarningEscalation(
                  interaction.guild,
                  member,
                  activeWarnings.length,
                  'Накопленные предупреждения'
              )
            : null;

        const caseId = await cases.addCase(interaction.guild.id, 'warn', {
            targetId: target.id,
            targetTag: target.tag,
            moderatorTag: interaction.user.tag,
            reason,
        });

        const embed = baseEmbed(COLORS.warning)
            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
            .setDescription(formatBody('Предупреждение выдано'))
            .addFields(
                { name: 'Участник', value: `${target}`, inline: true },
                { name: 'Модератор', value: `${interaction.user}`, inline: true },
                { name: 'Причина', value: reason },
                { name: 'Активных предупреждений', value: `${activeWarnings.length}`, inline: true }
            )
            .setFooter({ text: `Дело №${caseId} · ID: ${target.id}` });
        if (escalation?.action === 'timeout') {
            embed.addFields({
                name: 'Автоэскалация',
                value: 'Участник автоматически замьючен на 10 минут (3+ предупреждений).',
            });
        } else if (escalation?.action === 'ban') {
            embed.addFields({ name: 'Автоэскалация', value: 'Участник автоматически забанен (5+ предупреждений).' });
        }

        // Личные сообщения бот больше не шлёт вообще (по решению
        // администратора) — вместо этого приватный тред-уведомление
        // (utils/punishmentNotice.js), чтобы участник знал, за что
        // получил предупреждение. Пропускаем при бане — забаненный тред
        // всё равно прочитать не сможет (см. комментарий в
        // utils/punishmentNotice.js), notifyPunishment для 'ban' и так
        // ничего не делает, но нет смысла даже пытаться завести тред.
        if (escalation?.action !== 'ban') {
            await notifyPunishment(target, interaction.guild, { kind: 'warn', reason });
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
