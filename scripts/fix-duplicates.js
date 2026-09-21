require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const {
    findDuplicateRoles,
    findDuplicateChannels,
    buildIdReplacementMap,
    replaceIdsDeep,
} = require('../utils/duplicates');

// Запускать вручную: `docker compose run --rm bot node scripts/fix-duplicates.js`
// (не входит в деплой — разовая уборка по прямому запросу администратора,
// как fix-role-hierarchy.js и fix-leveling-ids.js). По умолчанию — только
// отчёт (dry-run), ничего не меняет. Реальные изменения (удаление ролей/
// каналов, правка config-сторов) — только с флагом --apply:
//   docker compose run --rm bot node scripts/fix-duplicates.js --apply
//
// В отличие от scripts/fix-role-hierarchy.js, где задвоенные роли
// намеренно оставлены только отчётом (решить, какую оставить, посчитали
// слишком рискованным для авточинки) — здесь администратор явно попросил
// именно автоматическую уборку дублей. Риск смягчён так же, как canonical
// выбирается везде в проекте (utils/idempotent.js pickOldest): самый
// старый по snowflake ID считается "настоящим", свежие дубли — уборка.
// Перед удалением роли её участники переносятся на канонической роль,
// перед удалением категории её дочерние каналы переносятся в
// каноническую — контент не теряется, теряются только сами дубли-пустышки.
//
// После уборки дублей скрипт проходит по всем config-сторам фич и меняет
// в них любые ссылки на удалённые ID на канонические — это и есть "правка
// остальных скриптов" из исходного запроса: сами scripts/setup-*.js уже
// умеют работать по сохранённому ID (см. idempotent.js), достаточно
// поправить сам ID в БД, а не код.
const APPLY = process.argv.includes('--apply');

// Все config-сторы фич, которые могут хранить ID каналов/ролей — полный
// список из find . -maxdepth 2 -name "config.js". У каждого экспортирован
// update() (utils/pgStore.js) — безопасный read-modify-write под блокировкой
// строки, единый для всех сторов независимо от того, экспортируют ли они
// ещё и save() напрямую.
const CONFIG_MODULES = [
    { label: 'changelog', mod: require('../changelog/config') },
    { label: 'commandsChannel', mod: require('../commandsChannel/config') },
    { label: 'ideaQueue', mod: require('../ideaQueue/config') },
    { label: 'leveling', mod: require('../leveling/config') },
    { label: 'modqueue', mod: require('../modqueue/config') },
    { label: 'presence', mod: require('../presence/config') },
    { label: 'rules', mod: require('../rules/config') },
    { label: 'security', mod: require('../security/config') },
    { label: 'suggestions', mod: require('../suggestions/config') },
    { label: 'tickets', mod: require('../tickets/config') },
    { label: 'voice', mod: require('../voice/config') },
];

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('clientReady', async () => {
    try {
        console.log(`=== Поиск дублей (${APPLY ? 'ПРИМЕНЯЮ изменения' : 'dry-run, ничего не меняю'}) ===\n`);

        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const roleGroups = findDuplicateRoles(
            [...guild.roles.cache.values()].map(r => ({
                id: r.id,
                name: r.name,
                managed: r.managed,
                everyone: r.id === guild.roles.everyone.id,
            }))
        );
        const channelGroups = findDuplicateChannels(
            [...guild.channels.cache.values()].map(c => ({
                id: c.id,
                type: c.type,
                parentId: c.parentId,
                name: c.name,
            }))
        );

        if (!roleGroups.length && !channelGroups.length) {
            console.log('Дублей не найдено — сервер чист.');
            process.exit(0);
        }

        // Участники нужны только для миграции с дублей ролей — фетчим
        // разом на весь сервер, только если такие дубли вообще есть.
        if (roleGroups.length) await guild.members.fetch();

        for (const { canonical, extras } of roleGroups) {
            console.log(
                `Роль "${canonical.name}": канонический ${canonical.id}, лишних — ${extras.length} (${extras.map(e => e.id).join(', ')})`
            );
            for (const extra of extras) {
                const role = guild.roles.cache.get(extra.id);
                const memberCount = role?.members.size ?? 0;
                console.log(`  ${extra.id}: участников для переноса — ${memberCount}`);
                if (!APPLY || !role) continue;
                for (const member of role.members.values()) {
                    await member.roles
                        .add(canonical.id)
                        .catch(err => console.error(`  ✘ ${member.id} add:`, err.message));
                }
                await role
                    .delete('fix-duplicates: дубликат роли, участники перенесены на канонический')
                    .then(() => console.log(`  ✔ Роль ${extra.id} удалена.`))
                    .catch(err => console.error(`  ✘ Не удалось удалить роль ${extra.id}:`, err.message));
            }
        }

        for (const { canonical, extras } of channelGroups) {
            const isCategory = canonical.type === ChannelType.GuildCategory;
            console.log(
                `Канал "${canonical.name}" (тип ${canonical.type}): канонический ${canonical.id}, лишних — ${extras.length} (${extras.map(e => e.id).join(', ')})`
            );
            for (const extra of extras) {
                const channel = guild.channels.cache.get(extra.id);
                if (isCategory) {
                    const children = guild.channels.cache.filter(c => c.parentId === extra.id);
                    console.log(`  ${extra.id}: дочерних каналов для переноса — ${children.size}`);
                    if (APPLY) {
                        for (const child of children.values()) {
                            await child
                                .setParent(canonical.id, { lockPermissions: false })
                                .catch(err => console.error(`  ✘ Перенос ${child.id}:`, err.message));
                        }
                    }
                }
                if (!APPLY || !channel) continue;
                await channel
                    .delete('fix-duplicates: дубликат канала')
                    .then(() => console.log(`  ✔ Канал ${extra.id} удалён.`))
                    .catch(err => console.error(`  ✘ Не удалось удалить канал ${extra.id}:`, err.message));
            }
        }

        const idMap = buildIdReplacementMap([...roleGroups, ...channelGroups]);
        console.log(`\n=== Правка config-сторов (${idMap.size} устаревших ID) ===`);
        for (const { label, mod } of CONFIG_MODULES) {
            if (APPLY) {
                let changed = false;
                await mod.update(config => {
                    const replaced = replaceIdsDeep(config, idMap);
                    if (JSON.stringify(replaced) !== JSON.stringify(config)) changed = true;
                    Object.assign(config, replaced);
                });
                console.log(`  ${label}: ${changed ? 'обновлён' : 'без изменений'}`);
            } else {
                const config = await mod.load();
                const replaced = replaceIdsDeep(config, idMap);
                const changed = JSON.stringify(replaced) !== JSON.stringify(config);
                console.log(`  ${label}: ${changed ? 'БУДЕТ обновлён' : 'без изменений'}`);
            }
        }

        console.log(
            APPLY
                ? '\nГотово. Дубли убраны, config-сторы обновлены.'
                : '\nЭто был dry-run — ничего не изменено. Запусти с --apply, чтобы применить.'
        );
        process.exit(0);
    } catch (err) {
        console.error('Ошибка при уборке дублей:', err);
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
