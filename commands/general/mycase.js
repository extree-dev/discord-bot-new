const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { COLORS, baseEmbed, formatBody, infoEmbed } = require('../../utils/embeds');
const { getActiveWarnings } = require('../../utils/warnings');
const moderation = require('../../moderation');

// Чисто self-service: без опции user и без прав модерации — иначе это был
// бы ещё один способ подглядеть чужое наказание помимо /warnings
// (ModerateMembers). Цель — чтобы участник сам узнал, за что и на сколько
// получил наказание, без обращения к стаффу через тикет/ЛС.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('mycase')
        .setDescription('Посмотреть свои активные предупреждения и мут — без обращения к модерации'),

    async execute(interaction) {
        const guild = interaction.guild;
        const member = interaction.member;

        const [activeWarnings, mutes] = await Promise.all([
            getActiveWarnings(guild.id, interaction.user.id),
            moderation.getConfig(),
        ]);

        const customMute = mutes[`${guild.id}_${interaction.user.id}`];
        // Автоэскалация (security/escalation.js) мутит нативным Discord-
        // таймаутом, а не кастомной ролью Muted (см. moderation/model.js) —
        // единственный источник нативного таймаута во всём боте, поэтому
        // причину можно смело писать общей фразой, не храня её отдельно.
        const nativeTimeoutUntil = member.communicationDisabledUntilTimestamp;
        const hasNativeTimeout = Boolean(nativeTimeoutUntil && nativeTimeoutUntil > Date.now());

        if (activeWarnings.length === 0 && !customMute && !hasNativeTimeout) {
            return interaction.reply({
                embeds: [infoEmbed('Активных предупреждений или мута нет.', 'Твой статус')],
                flags: MessageFlags.Ephemeral,
            });
        }

        const embed = baseEmbed(COLORS.warning).setDescription(formatBody('Твой статус'));

        if (customMute) {
            embed.addFields({
                name: '🔇 Мут',
                value: `Истекает: <t:${Math.floor(customMute.expiresAt / 1000)}:R>\nПричина: ${customMute.reason}`,
            });
        } else if (hasNativeTimeout) {
            embed.addFields({
                name: '🔇 Тайм-аут',
                value: `Истекает: <t:${Math.floor(nativeTimeoutUntil / 1000)}:R>\nПричина: автоматическая эскалация предупреждений (3+ активных).`,
            });
        }

        if (activeWarnings.length > 0) {
            const shown = activeWarnings.slice(-8);
            const omitted = activeWarnings.length - shown.length;
            const lines = shown.map(
                (w, i) =>
                    `**${i + 1}.** ${w.reason} — от ${w.moderatorTag} (${new Date(w.date).toLocaleString('ru-RU')})`
            );
            if (omitted > 0) lines.unshift(`_…и ещё ${omitted} ранее_`);

            embed.addFields({ name: `⚠️ Предупреждения (${activeWarnings.length})`, value: lines.join('\n') });
        }

        embed.setFooter({
            text: 'Предупреждения старше 30 дней не считаются и не показываются здесь. Не согласен с наказанием — подай апелляцию через общую панель обращений.',
        });

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};
