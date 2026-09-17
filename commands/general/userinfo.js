const { SlashCommandBuilder } = require('discord.js');
const { COLORS, baseEmbed, formatBody } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Показать информацию об участнике')
        .addUserOption(option =>
            option.setName('user').setDescription('Участник (по умолчанию — ты)').setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        const embed = baseEmbed(COLORS.primary)
            .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: 'Участник', value: `${target}`, inline: true },
                { name: 'ID', value: target.id, inline: true },
                { name: 'Аккаунт создан', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true }
            );

        if (member) {
            const everyoneId = interaction.guild.roles.everyone.id;
            const roles = member.roles.cache
                .filter(role => role.id !== everyoneId)
                .sort((a, b) => b.position - a.position)
                .map(role => `${role}`);

            embed.addFields(
                { name: 'На сервере с', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: `Роли (${roles.length})`, value: roles.length ? roles.slice(0, 20).join(' ') : 'нет' }
            );
            embed.setDescription(formatBody('Информация об участнике'));
        } else {
            embed.setDescription(
                formatBody(
                    'Информация об участнике',
                    'Этот пользователь не найден на сервере — показана только информация об аккаунте Discord.'
                )
            );
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
