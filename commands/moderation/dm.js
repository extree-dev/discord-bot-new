const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { COLORS, baseEmbed, formatBody, errorEmbed, successEmbed } = require('../../utils/embeds');
const { buildClearHistoryButtonRow } = require('../../utils/dm');
const security = require('../../security');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Отправить личное сообщение от имени бота')
        .addUserOption(option => option.setName('user').setDescription('Пользователь').setRequired(true))
        .addStringOption(option =>
            option.setName('text').setDescription('Текст сообщения').setMaxLength(2000).setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const text = interaction.options.getString('text');

        try {
            await target.send({ content: text, components: [buildClearHistoryButtonRow()] });
        } catch (err) {
            return interaction.reply({
                embeds: [
                    errorEmbed(
                        `Не удалось отправить личное сообщение (у пользователя могут быть закрыты DM): ${err.message}`
                    ),
                ],
                ephemeral: true,
            });
        }

        await interaction.reply({
            embeds: [successEmbed(`Личное сообщение отправлено ${target}.`)],
            ephemeral: true,
        });

        // См. say.js — Discord не логирует DM бота сам, запись в
        // security-log нужна для отчётности, кто и что отправил.
        await security.log(
            interaction.guild,
            baseEmbed(COLORS.neutral)
                .setDescription(formatBody('Личное сообщение от имени бота (/dm)'))
                .addFields(
                    { name: 'Администратор', value: `${interaction.user}`, inline: true },
                    { name: 'Получатель', value: `${target.tag} (${target.id})`, inline: true },
                    { name: 'Текст', value: text.slice(0, 1000) }
                )
        );
    },
};
