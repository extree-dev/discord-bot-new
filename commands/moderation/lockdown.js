const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const security = require('../../security');
const { COLORS, baseEmbed, infoEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Экстренная блокировка сервера — запрет писать и заходить в голосовые всем участникам')
        .addSubcommand(sub => sub.setName('on').setDescription('Включить блокировку прямо сейчас'))
        .addSubcommand(sub => sub.setName('off').setDescription('Снять блокировку'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        if (sub === 'on') {
            const result = await security.activateLockdown(interaction.guild, interaction.user);
            if (result.alreadyActive) {
                return interaction.editReply({ embeds: [infoEmbed('Lockdown уже включён.', 'Lockdown')] });
            }
            const embed = baseEmbed(COLORS.critical)
                .setTitle('Lockdown включён')
                .setDescription('Сервер заблокирован: писать и заходить в голосовые каналы больше нельзя никому.')
                .addFields({ name: 'Каналов закрыто', value: `${result.count}`, inline: true });
            return interaction.editReply({ embeds: [embed] });
        }

        const result = await security.deactivateLockdown(interaction.guild, interaction.user);
        if (!result.wasActive) {
            return interaction.editReply({ embeds: [infoEmbed('Lockdown не был включён.', 'Lockdown')] });
        }
        const embed = baseEmbed(COLORS.success)
            .setTitle('Lockdown снят')
            .setDescription('Доступ к каналам восстановлен для всех, кого блокировка коснулась.')
            .addFields({ name: 'Каналов открыто', value: `${result.count}`, inline: true });
        return interaction.editReply({ embeds: [embed] });
    },
};
