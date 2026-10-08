import { useEffect, useMemo, useState } from 'react';
import { getGuildMembers } from '../../entities/guild-members/api';
import type { GuildMember } from '../../entities/guild-members/types';
import { useLang } from '../../shared/lib/useLang';
import type { TranslationKey } from '../../shared/lib/i18n/translations';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { DataTable, type DataTableColumn, type DataTableFilter } from '../../shared/ui/DataTable';
import styles from './MembersPage.module.css';

function buildColumns(t: (key: TranslationKey) => string): DataTableColumn<GuildMember>[] {
    return [
        {
            key: 'user',
            label: t('members.colUser'),
            sortable: true,
            sortValue: m => (m.globalName ?? m.username).toLowerCase(),
            render: m => (
                <div className={styles.userCell}>
                    <Avatar src={m.avatarUrl} alt="" size="tiny" />
                    <div className={styles.userText}>
                        <span className={styles.userName}>{m.globalName ?? m.username}</span>
                        <span className={styles.userHandle}>@{m.username}</span>
                    </div>
                </div>
            ),
        },
        {
            key: 'roles',
            label: t('members.colRoles'),
            render: m =>
                m.roles.length === 0 ? (
                    <span className={styles.muted}>{t('members.noRoles')}</span>
                ) : (
                    <div className={styles.roleList}>
                        {m.roles.slice(0, 3).map(r => (
                            <Badge key={r.id}>{r.name}</Badge>
                        ))}
                        {m.roles.length > 3 && <Badge>+{m.roles.length - 3}</Badge>}
                    </div>
                ),
        },
        {
            key: 'joinedAt',
            label: t('members.colJoined'),
            sortable: true,
            sortValue: m => (m.joinedAt ? new Date(m.joinedAt).getTime() : 0),
            render: m => (m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('ru-RU') : '—'),
        },
    ];
}

// Гейт — в AdminShell. Полный ростер сервера грузится одним запросом
// (см. GET /api/guild-members) — дальше поиск/сортировка/пагинация
// целиком на клиенте, см. shared/ui/DataTable.
export function MembersPage() {
    const [members, setMembers] = useState<GuildMember[] | null>(null);
    const { lang, t } = useLang();

    useEffect(() => {
        document.title = `${t('members.title')} — Extree`;
    }, [lang, t]);

    useEffect(() => {
        let cancelled = false;
        getGuildMembers().then(({ members }) => {
            if (!cancelled) setMembers(members);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const columns = useMemo(() => buildColumns(t), [t]);

    // Опции фильтра — из уже загруженного списка участников, а не
    // отдельным запросом: ролей на сервере обычно немного, перебрать их
    // все одним проходом по members дешевле, чем городить ещё один GET.
    const filters = useMemo<DataTableFilter<GuildMember>[]>(() => {
        if (!members) return [];
        const roleNameById = new Map<string, string>();
        for (const m of members) {
            for (const r of m.roles) roleNameById.set(r.id, r.name);
        }
        const options = [...roleNameById.entries()]
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([value, label]) => ({ value, label }));
        if (options.length === 0) return [];
        return [
            {
                key: 'role',
                label: t('members.filterRole'),
                options,
                match: (m, value) => m.roles.some(r => r.id === value),
            },
        ];
    }, [members, t]);

    return (
        <div className={styles.page}>
            <h1>{t('members.title')}</h1>
            <p className={styles.lead}>{t('members.lead')}</p>
            {members && (
                <DataTable
                    columns={columns}
                    rows={members}
                    getRowId={m => m.id}
                    searchPlaceholder={t('members.searchPlaceholder')}
                    searchKeys={m => [m.username, m.globalName ?? '']}
                    filters={filters}
                />
            )}
        </div>
    );
}
