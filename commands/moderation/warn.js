const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { addWarning } = require('../../utils/warnings');
const { COLORS, baseEmbed, formatBody } = require('../../utils/embeds');
const { notifyPunishment } = require('../../utils/punishmentNotice');
const security = require('../../security');

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

        const warnings = await addWarning(interaction.guild.id, target.id, reason, interaction.user.tag);

        // Общая эскалация (3 предупреждения → тайм-аут, 5 → бан) — та же
        // функция, что использует automod, применяется к общему числу
        // варнов независимо от того, что они выданы вручную, а не
        // automod'ом (см. security/escalation.js).
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        const escalation = member
            ? await security.applyWarningEscalation(
                  interaction.guild,
                  member,
                  warnings.length,
                  'Накопленные предупреждения'
              )
            : null;

        const embed = baseEmbed(COLORS.warning)
            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
            .setDescription(formatBody('Предупреждение выдано'))
            .addFields(
                { name: 'Участник', value: `${target}`, inline: true },
                { name: 'Модератор', value: `${interaction.user}`, inline: true },
                { name: 'Причина', value: reason },
                { name: 'Всего предупреждений', value: `${warnings.length}`, inline: true }
            )
            .setFooter({ text: `ID: ${target.id}` });
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
