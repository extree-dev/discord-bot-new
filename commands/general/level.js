const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const leveling = require('../../leveling');

// set/reset вынесены в отдельную команду commands/moderation/level-admin.js —
// см. комментарий там, почему сабкоманды тут не годятся для админских
// действий (Discord прячет от участника команду только целиком).
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
        .addSubcommand(sub => sub.setName('leaderboard').setDescription('Топ участников по активности')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (sub === 'profile') {
            // deferReply обязателен: buildRankCardAttachment делает force-fetch
            // пользователя и параллельно тянет аватар/баннер с CDN Discord перед
            // рендером канваса — суммарно легко выходит за 3-секундное окно
            // ответа на interaction.
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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

        // leaderboard — deferReply та же причина, что и у profile: собираем
        // аватары до 10 участников параллельно и рендерим картинку. НЕ
        // ephemeral — топ активности должен быть виден всем в канале.
        await interaction.deferReply();
        const top = await leveling.getLeaderboard(guildId, 10);
        const entries = top.map((e, i) => ({ ...e, rank: i + 1 }));
        const attachment = await leveling.buildLeaderboardAttachment(interaction.client, entries);
        await interaction.editReply({ files: [attachment] });
    },
};
