const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Выдать или снять роль участнику')
        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Выдать роль')
                .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))
                .addRoleOption(option => option.setName('role').setDescription('Роль').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Снять роль')
                .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))
                .addRoleOption(option => option.setName('role').setDescription('Роль').setRequired(true))
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({
                embeds: [errorEmbed('Не удалось найти этого участника на сервере.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        const botHighestRole = interaction.guild.members.me.roles.highest;
        if (role.position >= botHighestRole.position) {
            return interaction.reply({
                embeds: [errorEmbed('Эта роль выше или равна высшей роли бота — я не могу ей управлять.')],
                flags: MessageFlags.Ephemeral,
            });
        }
        if (role.managed) {
            return interaction.reply({
                embeds: [errorEmbed('Это роль интеграции/бота — ей нельзя управлять вручную.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'add') {
            if (member.roles.cache.has(role.id)) {
                return interaction.reply({
                    embeds: [errorEmbed(`У ${member} уже есть роль ${role}.`)],
                    flags: MessageFlags.Ephemeral,
                });
            }
            await member.roles.add(role, `Выдано: ${interaction.user.tag}`);
            return interaction.reply({
                embeds: [successEmbed(`${member} получил роль ${role}.`, 'Роль выдана')],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (!member.roles.cache.has(role.id)) {
            return interaction.reply({
                embeds: [errorEmbed(`У ${member} нет роли ${role}.`)],
                flags: MessageFlags.Ephemeral,
            });
        }
        await member.roles.remove(role, `Снято: ${interaction.user.tag}`);
        return interaction.reply({
            embeds: [successEmbed(`У ${member} снята роль ${role}.`, 'Роль снята')],
            flags: MessageFlags.Ephemeral,
        });
    },
};
