const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
                ephemeral: true,
            });
        }

        const botHighestRole = interaction.guild.members.me.roles.highest;
        if (role.position >= botHighestRole.position) {
            return interaction.reply({
                embeds: [errorEmbed('Эта роль выше или равна высшей роли бота — я не могу ей управлять.')],
                ephemeral: true,
            });
        }
        if (role.managed) {
            return interaction.reply({
                embeds: [errorEmbed('Это роль интеграции/бота — ей нельзя управлять вручную.')],
                ephemeral: true,
            });
        }

        if (sub === 'add') {
            if (member.roles.cache.has(role.id)) {
                return interaction.reply({
                    embeds: [errorEmbed(`У ${member} уже есть роль ${role}.`)],
                    ephemeral: true,
                });
            }
            await member.roles.add(role, `Выдано: ${interaction.user.tag}`);
            return interaction.reply({
                embeds: [successEmbed(`${member} получил роль ${role}.`, 'Роль выдана')],
                ephemeral: true,
            });
        }

        if (!member.roles.cache.has(role.id)) {
            return interaction.reply({ embeds: [errorEmbed(`У ${member} нет роли ${role}.`)], ephemeral: true });
        }
        await member.roles.remove(role, `Снято: ${interaction.user.tag}`);
        return interaction.reply({
            embeds: [successEmbed(`У ${member} снята роль ${role}.`, 'Роль снята')],
            ephemeral: true,
        });
    },
};
