const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { COLORS, baseEmbed, formatBody, errorEmbed, successEmbed } = require('../../utils/embeds');
const { clearBotDmHistory } = require('../../utils/dm');
const security = require('../../security');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm-clear')
        .setDescription('Удалить личные сообщения бота этому участнику (только сообщения бота, не участника)')
        .addUserOption(option => option.setName('user').setDescription('Пользователь').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = await clearBotDmHistory(interaction.client, target.id);
        if (result.error) {
            await interaction.editReply({ embeds: [errorEmbed(result.error)] });
            return;
        }
        await interaction.editReply({
            embeds: [successEmbed(`Удалено сообщений бота в личке с ${target}: ${result.deleted}.`, 'Готово')],
        });

        // См. dm.js — Discord не логирует DM бота сам, запись в
        // security-log нужна для отчётности, кто и когда чистил чужую
        // переписку с ботом.
        await security.log(
            interaction.guild,
            baseEmbed(COLORS.neutral)
                .setDescription(formatBody('Очищена личная переписка с ботом (/dm-clear)'))
                .addFields(
                    { name: 'Администратор', value: `${interaction.user}`, inline: true },
                    { name: 'Участник', value: `${target.tag} (${target.id})`, inline: true },
                    { name: 'Удалено сообщений', value: `${result.deleted}`, inline: true }
                )
        );
    },
};
