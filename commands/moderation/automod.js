const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const security = require('../../security');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

// Раньше bannedWords (security/config.js) можно было поменять только
// прямой правкой записи в БД — ни одной команды для этого не было, хотя
// automod.js (security/automod.js) уже проверяет список на каждом
// сообщении. /automod даёт администратору управлять им и включать/
// выключать automod целиком без похода в БД.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Управление автоматической модерацией')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(group =>
            group
                .setName('word')
                .setDescription('Список запрещённых слов')
                .addSubcommand(sub =>
                    sub
                        .setName('add')
                        .setDescription('Добавить слово или фразу в список запрещённых')
                        .addStringOption(opt => opt.setName('word').setDescription('Слово или фраза').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName('remove')
                        .setDescription('Убрать слово или фразу из списка запрещённых')
                        .addStringOption(opt => opt.setName('word').setDescription('Слово или фраза').setRequired(true))
                )
                .addSubcommand(sub => sub.setName('list').setDescription('Показать список запрещённых слов'))
        )
        .addSubcommand(sub =>
            sub
                .setName('toggle')
                .setDescription('Включить или выключить automod целиком')
                .addBooleanOption(opt =>
                    opt.setName('enabled').setDescription('true — включить, false — выключить').setRequired(true)
                )
        ),

    async execute(interaction) {
        const group = interaction.options.getSubcommandGroup(false);

        if (group === 'word') {
            await handleWordSubcommand(interaction);
            return;
        }

        const enabled = interaction.options.getBoolean('enabled');
        await security.updateConfig(cfg => {
            cfg.automod.enabled = enabled;
        });
        await interaction.reply({
            embeds: [successEmbed(`Automod теперь ${enabled ? 'включён' : 'выключен'}.`)],
            flags: MessageFlags.Ephemeral,
        });
    },
};

async function handleWordSubcommand(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = await security.getConfig();

    if (sub === 'list') {
        const list = config.bannedWords.length ? config.bannedWords.map(w => `\`${w}\``).join(', ') : 'Список пуст.';
        await interaction.reply({
            embeds: [successEmbed(list, `Запрещённые слова (${config.bannedWords.length})`)],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // automod.js ищет совпадение через lower().includes(w.toLowerCase())
    // (см. security/automod.js handle()) — нормализуем регистр уже здесь,
    // чтобы /automod word list показывал ровно то, что реально участвует
    // в сравнении, без сюрпризов из-за разного регистра одного и того же
    // слова.
    const word = interaction.options.getString('word').trim().toLowerCase();
    if (!word) {
        await interaction.reply({ embeds: [errorEmbed('Пустое слово.')], flags: MessageFlags.Ephemeral });
        return;
    }

    if (sub === 'add') {
        if (config.bannedWords.includes(word)) {
            await interaction.reply({ embeds: [errorEmbed(`«${word}» уже в списке.`)], flags: MessageFlags.Ephemeral });
            return;
        }
        await security.updateConfig(cfg => {
            cfg.bannedWords.push(word);
        });
        await interaction.reply({
            embeds: [successEmbed(`«${word}» добавлено в список запрещённых слов.`)],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // remove
    const existed = config.bannedWords.includes(word);
    await security.updateConfig(cfg => {
        cfg.bannedWords = cfg.bannedWords.filter(w => w !== word);
    });
    await interaction.reply({
        embeds: [
            existed
                ? successEmbed(`«${word}» убрано из списка запрещённых слов.`)
                : errorEmbed(`«${word}» и так не было в списке.`),
        ],
        flags: MessageFlags.Ephemeral,
    });
}
