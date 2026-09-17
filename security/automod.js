const { PermissionFlagsBits } = require('discord.js');
const { load, isTrusted } = require('./config');
const { log } = require('./logger');
const { addWarning } = require('../utils/warnings');
const { COLORS, baseEmbed } = require('../utils/embeds');

const messageTimestamps = new Map();
const INVITE_REGEX = /(discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i;

async function violate(msg, reasonText) {
    await msg.delete().catch(() => {});
    const warnings = await addWarning(msg.guild.id, msg.author.id, `[Automod] ${reasonText}`, 'Automod');

    await log(
        msg.guild,
        baseEmbed(COLORS.warning)
            .setTitle('🤖 Automod сработал')
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

    if (INVITE_REGEX.test(msg.content)) {
        return violate(msg, 'Приглашение на сторонний сервер');
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

module.exports = { register };
