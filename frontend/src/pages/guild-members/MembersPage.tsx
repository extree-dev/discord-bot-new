import { useEffect, useState } from 'react';
import { getGuildMembers } from '../../entities/guild-members/api';
import type { GuildMember } from '../../entities/guild-members/types';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { DataTable, type DataTableColumn } from '../../shared/ui/DataTable';
import styles from './MembersPage.module.css';

const COLUMNS: DataTableColumn<GuildMember>[] = [
    {
        key: 'user',
        label: 'Участник',
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
        label: 'Роли',
        render: m =>
            m.roles.length === 0 ? (
                <span className={styles.muted}>—</span>
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
        label: 'На сервере с',
        sortable: true,
        sortValue: m => (m.joinedAt ? new Date(m.joinedAt).getTime() : 0),
        render: m => (m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('ru-RU') : '—'),
    },
];

// Гейт — в AdminShell. Полный ростер сервера грузится одним запросом
// (см. GET /api/guild-members) — дальше поиск/сортировка/пагинация
// целиком на клиенте, см. shared/ui/DataTable.
export function MembersPage() {
    const [members, setMembers] = useState<GuildMember[] | null>(null);

    useEffect(() => {
        document.title = 'Участники — Extree';
        let cancelled = false;
        getGuildMembers().then(({ members }) => {
            if (!cancelled) setMembers(members);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className={styles.page}>
            <h1>Участники</h1>
            <p className={styles.lead}>Все участники сервера, где работает Extree — живой список из Discord.</p>
            {members && (
                <DataTable
                    columns={COLUMNS}
                    rows={members}
                    getRowId={m => m.id}
                    searchPlaceholder="Поиск по имени"
                    searchKeys={m => [m.username, m.globalName ?? '']}
                />
            )}
        </div>
    );
}
