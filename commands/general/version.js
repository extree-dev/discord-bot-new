const { SlashCommandBuilder, EmbedBuilder, version: discordJsVersion } = require('discord.js');
const { getVersion, getAppName, formatUptime } = require('../../utils/version');

module.exports = {
    data: new SlashCommandBuilder().setName('version').setDescription('Показать версию бота и окружения'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('О боте')
            .addFields(
                { name: 'Версия', value: `v${getVersion()}`, inline: true },
                { name: 'discord.js', value: `v${discordJsVersion}`, inline: true },
                { name: 'Node.js', value: process.version, inline: true },
                { name: 'Аптайм процесса', value: formatUptime(process.uptime()), inline: true }
            )
            .setFooter({ text: getAppName() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
