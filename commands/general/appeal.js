const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moderation = require('../../moderation');
const security = require('../../security');
const { COLORS, baseEmbed, formatBody, infoEmbed, successEmbed } = require('../../utils/embeds');

// Мут считается "практически отбытым" и снимается сразу, без решения
// стаффа — на таком коротком хвосте срока результат один и тот же
// (участник и так почти свободен), а ручной разбор только тратит время
// модерации на то, что через несколько минут снялось бы само по sweep.js.
const AUTO_APPROVE_REMAINING_MS = 10 * 60 * 1000;

// Только мут — забаненный участник теряет доступ вообще ко всем
// каналам/слэш-командам гильдии, включая эту, так что для бана эта
// команда физически недостижима (см. utils/punishmentNotice.js — тот же
// повод, по которому забаненным не шлётся уведомление о наказании).
module.exports = {
    data: new SlashCommandBuilder()
        .setName('appeal')
        .setDescription('Подать апелляцию на свой текущий мут')
        .addStringOption(option =>
            option.setName('reason').setDescription('Почему мут нужно снять раньше срока').setRequired(true)
        ),

    async execute(interaction) {
        const reason = interaction.options.getString('reason');
        const mutes = await moderation.getConfig();
        const entry = mutes[`${interaction.guild.id}_${interaction.user.id}`];

        if (!entry) {
            await interaction.reply({
                embeds: [
                    infoEmbed(
                        'У тебя нет активного мута — апеллировать нечего. Апелляция на бан через бота недоступна: забаненный теряет доступ ко всем каналам и командам сервера, включая эту, — обратись к администрации напрямую.',
                        'Нет активного мута'
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const remainingMs = entry.expiresAt - Date.now();
        if (remainingMs <= AUTO_APPROVE_REMAINING_MS) {
            await moderation.unmuteMember(interaction.guild, interaction.user.id);
            await interaction.reply({
                embeds: [successEmbed('Срок мута почти истёк — снят автоматически.', 'Мут снят')],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await security.log(
            interaction.guild,
            baseEmbed(COLORS.warning)
                .setDescription(formatBody('Апелляция на мут'))
                .addFields(
                    { name: 'Участник', value: `${interaction.user}`, inline: true },
                    { name: 'Осталось', value: `${Math.ceil(remainingMs / 60000)} мин.`, inline: true },
                    { name: 'Причина мута', value: entry.reason || 'не указана' },
                    { name: 'Объяснение участника', value: reason }
                )
        );

        await interaction.reply({
            embeds: [
                infoEmbed(
                    'Апелляция отправлена на рассмотрение модерации. Решат снять мут раньше срока — сделают это вручную.',
                    'Отправлено'
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
};
