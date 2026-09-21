const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const leveling = require('../../leveling');
const { errorEmbed, successEmbed } = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Уровень активности участников сервера')
        .addSubcommand(sub =>
            sub
                .setName('profile')
                .setDescription('Показать профиль уровня активности')
                .addUserOption(opt => opt.setName('user').setDescription('Чей профиль (по умолчанию — твой)'))
        )
        .addSubcommand(sub => sub.setName('leaderboard').setDescription('Топ участников по активности'))
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Задать счёт активности участнику вручную (модерация)')
                .addUserOption(opt => opt.setName('user').setDescription('Кому').setRequired(true))
                .addIntegerOption(opt =>
                    opt.setName('amount').setDescription('Новое значение счёта').setRequired(true).setMinValue(0)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'profile') {
            // deferReply обязателен: buildRankCardAttachment делает force-fetch
            // пользователя и параллельно тянет аватар/баннер с CDN Discord перед
            // рендером канваса — суммарно легко выходит за 3-секундное окно
            // ответа на interaction.
            await interaction.deferReply({ ephemeral: true });
            const target = interaction.options.getUser('user') ?? interaction.user;
            const profile = await leveling.getProfile(guildId, target.id);
            const attachment = await leveling.buildRankCardAttachment(
                interaction.client,
                target.id,
                profile,
                interaction.guild
            );
            await interaction.editReply({ files: [attachment] });
            return;
        }

        if (sub === 'leaderboard') {
            // deferReply — та же причина, что и у profile: собираем аватары
            // до 10 участников параллельно и рендерим картинку. НЕ ephemeral —
            // топ активности должен быть виден всем в канале.
            await interaction.deferReply();
            const top = await leveling.getLeaderboard(guildId, 10);
            const entries = top.map((e, i) => ({ ...e, rank: i + 1 }));
            const attachment = await leveling.buildLeaderboardAttachment(interaction.client, entries);
            await interaction.editReply({ files: [attachment] });
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
        const result = await leveling.setScore(guildId, target.id, amount);

        // Роли ярусов складываются (см. leveling/model.js grantLevelRolesUpTo) —
        // ручная правка счёта может разом перепрыгнуть несколько ярусов,
        // поэтому выдаём все роли от первого яруса до текущего, а не
        // только роль последнего.
        await leveling.grantLevelRolesUpTo(interaction.guild, target.id, result.level.index);

        await interaction.reply({
            embeds: [
                successEmbed(
                    `Счёт активности ${target} установлен: ${result.newScore} (${result.level.title}, уровень ${result.level.number}).`,
                    'Готово'
                ),
            ],
            ephemeral: true,
        });
    },
};
