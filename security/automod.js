const { PermissionFlagsBits } = require('discord.js');
const { load, isTrusted } = require('./config');
const { log } = require('./logger');
const { addWarning } = require('../utils/warnings');
const { COLORS, baseEmbed, formatBody } = require('../utils/embeds');

const messageTimestamps = new Map();
const INVITE_REGEX = /(discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i;

// Небольшой курируемый список типичных паттернов фишинга/скама, которые
// массово рассылают через компрометированные аккаунты и веб-хуки:
// поддельные раздачи Nitro, поддельные трейд-офферы Steam, тайпсквоты
// домена discord.com. Не претендует на полноту — это первая линия
// защиты от самых частых шаблонов, не универсальный антифишинг-сервис.
const PHISHING_REGEX =
    /(dis(?:c|cc|k)ord(?:app)?[-.]?(?:nitro|gift|airdrop)|steamcommunity[-.]?(?:gift|trade)|free[-.]?nitro)\.[a-z]{2,10}\b/i;

// Массовый КАПС читается как агрессия/спам. Проверяем долю прописных
// букв только среди буквенных символов (а не среди всей строки), иначе
// упоминания/ссылки/эмодзи искажали бы долю в любую сторону.
function isExcessiveCaps(content) {
    const letters = content.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
    if (letters.length < 12) return false;
    const upper = letters.replace(/[^A-ZА-ЯЁ]/g, '');
    return upper.length / letters.length > 0.7;
}

function isInviteLink(content) {
    return INVITE_REGEX.test(content);
}

function isPhishingLink(content) {
    return PHISHING_REGEX.test(content);
}

async function violate(msg, reasonText) {
    await msg.delete().catch(() => {});
    const warnings = await addWarning(msg.guild.id, msg.author.id, `[Automod] ${reasonText}`, 'Automod');

    await log(
        msg.guild,
        baseEmbed(COLORS.warning)
            .setDescription(formatBody('Automod сработал'))
            .addFields(
                { name: 'Участник', value: `${msg.author.tag} (${msg.author.id})`, inline: true },
                { name: 'Канал', value: `${msg.channel}`, inline: true },
                { name: 'Причина', value: reasonText },
                { name: 'Предупреждений всего', value: `${warnings.length}` }
            )
    );

    const member = await msg.guild.members.fetch(msg.author.id).catch(() => null);
    if (!member) return;

    if (warnings.length >= 5 && member.bannable) {
        await member.ban({ reason: 'Automod: 5+ нарушений' }).catch(() => {});
    } else if (warnings.length >= 3 && member.moderatable) {
        await member.timeout(10 * 60 * 1000, 'Automod: 3+ нарушений').catch(() => {});
    }
}

async function handle(msg) {
    if (!msg.guild || msg.author.bot) return;
    const config = await load();
    if (!config.automod.enabled) return;
    if (await isTrusted(msg.guild, msg.author.id)) return;

    const member = msg.member ?? (await msg.guild.members.fetch(msg.author.id).catch(() => null));
    if (member?.permissions.has(PermissionFlagsBits.ModerateMembers)) return;

    const mentionCount = msg.mentions.users.size + msg.mentions.roles.size;
    if (mentionCount >= config.automod.maxMentions) {
        return violate(msg, `Масс-упоминания (${mentionCount})`);
    }

    const arr = (messageTimestamps.get(msg.author.id) ?? []).filter(
        ts => Date.now() - ts <= config.automod.messageWindowMs
    );
    arr.push(Date.now());
    if (arr.length >= config.automod.maxMessagesPerWindow) {
        messageTimestamps.set(msg.author.id, []);
        return violate(msg, `Спам сообщениями (${arr.length} за ${config.automod.messageWindowMs / 1000} сек.)`);
    }
    messageTimestamps.set(msg.author.id, arr);

    if (isInviteLink(msg.content)) {
        return violate(msg, 'Приглашение на сторонний сервер');
    }

    if (isPhishingLink(msg.content)) {
        return violate(msg, 'Похоже на фишинговую/скам-ссылку');
    }

    if (isExcessiveCaps(msg.content)) {
        return violate(msg, 'Избыточный капс');
    }

    const lower = msg.content.toLowerCase();
    const hit = config.bannedWords.find(w => w && lower.includes(w.toLowerCase()));
    if (hit) {
        return violate(msg, 'Запрещённое слово');
    }
}

function register(client) {
    client.on('messageCreate', msg => handle(msg).catch(err => console.error('automod:', err)));
}

module.exports = { register, isInviteLink, isPhishingLink, isExcessiveCaps };
