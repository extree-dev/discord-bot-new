const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const reputation = require('../../reputation');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { toMessage } = require('../../utils/components');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rep')
        .setDescription('Репутация участников сервера')
        .addSubcommand(sub =>
            sub
                .setName('give')
                .setDescription('Дать репутацию участнику')
                .addUserOption(opt => opt.setName('user').setDescription('Кому дать репутацию').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('profile')
                .setDescription('Показать профиль репутации')
                .addUserOption(opt => opt.setName('user').setDescription('Чей профиль (по умолчанию — твой)'))
        )
        .addSubcommand(sub => sub.setName('leaderboard').setDescription('Топ участников по репутации'))
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Задать репутацию участнику вручную (модерация)')
                .addUserOption(opt => opt.setName('user').setDescription('Кому').setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('amount').setDescription('Новое значение репутации').setRequired(true).setMinValue(0)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'give') {
            const target = interaction.options.getUser('user');
            const result = await reputation.giveReputation(guildId, interaction.user.id, target.id);
            if (result.error) {
                await interaction.reply({ embeds: [errorEmbed(result.error)], ephemeral: true });
                return;
            }

            await interaction.reply({
                embeds: [
                    successEmbed(
                        `${target} получил репутацию от ${interaction.user}. Текущий счёт: ${result.newScore}.`,
                        'Репутация начислена'
                    ),
                ],
            });

            // firstPoint — первое очко вообще (см. giveReputation): индекс
            // уровня не меняется (0 и 1-4 очка — оба "Новичок"), но именно
            // тогда нужно выдать саму роль уровня "Новичок" первый раз.
            if (result.leveledUp || result.firstPoint) {
                const roleId = await reputation.getLevelRoleId(guildId, result.levelIndex);
                if (roleId) {
                    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
                    await member?.roles.add(roleId).catch(() => {});
                }
                const level = reputation.LEVELS[result.levelIndex];
                await interaction.channel
                    ?.send(toMessage(reputation.buildLevelUpCard(`${target}`, level)))
                    .catch(() => {});
            }
            return;
        }

        if (sub === 'profile') {
            // deferReply обязателен: buildRankCardAttachment делает force-fetch
            // пользователя и параллельно тянет аватар/баннер с CDN Discord перед
            // рендером канваса — суммарно легко выходит за 3-секундное окно
            // ответа на interaction, и без defer второй/третий запрос подряд
            // укладывался в лимит нестабильно (иногда — "Взаимодействие не
            // удалось" на клиенте).
            await interaction.deferReply();
            const target = interaction.options.getUser('user') ?? interaction.user;
            const profile = await reputation.getProfile(guildId, target.id);
            const attachment = await reputation.buildRankCardAttachment(
                interaction.client,
                target.id,
                profile,
                interaction.guild
            );
            await interaction.editReply({ files: [attachment] });
            return;
        }

        if (sub === 'leaderboard') {
            const top = await reputation.getLeaderboard(guildId, 10);
            const entries = top.map((e, i) => ({ ...e, rank: i + 1 }));
            await interaction.reply(toMessage(reputation.buildLeaderboardCard(entries)));
            return;
        }

        // set — ручная корректировка, доступна только модерации (те же
        // права, что и у большинства других модераторских команд бота).
        if (
            !interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
            !interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)
        ) {
            await interaction.reply({
                embeds: [errorEmbed('Эта команда доступна только модерации.')],
                ephemeral: true,
            });
            return;
        }
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const result = await reputation.setReputation(guildId, target.id, amount);
        await interaction.reply({
            embeds: [
                successEmbed(`Репутация ${target} установлена: ${result.newScore} (${result.level.title}).`, 'Готово'),
            ],
            ephemeral: true,
        });
    },
};
