import { useEffect, useState } from 'react';
import { getBannedMembers } from '../../entities/guild-members/api';
import type { BannedMember } from '../../entities/guild-members/types';
import { Avatar } from '../../shared/ui/Avatar';
import { DataTable, type DataTableColumn } from '../../shared/ui/DataTable';
import styles from '../guild-members/MembersPage.module.css';

const COLUMNS: DataTableColumn<BannedMember>[] = [
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
    { key: 'reason', label: 'Причина', render: m => m.reason ?? '—' },
    { key: 'moderatorTag', label: 'Кто забанил', render: m => m.moderatorTag ?? '—' },
    {
        key: 'bannedAt',
        label: 'Когда',
        sortable: true,
        sortValue: m => (m.bannedAt ? new Date(m.bannedAt).getTime() : 0),
        render: m => (m.bannedAt ? new Date(m.bannedAt).toLocaleString('ru-RU') : '—'),
    },
];

// Гейт — в AdminShell. Живой список банов от Discord, дополненный
// модератором/датой из собственного журнала /ban там, где это есть —
// см. GET /api/banned-members.
export function BannedPage() {
    const [banned, setBanned] = useState<BannedMember[] | null>(null);

    useEffect(() => {
        document.title = 'Заблокированные — Extree';
        let cancelled = false;
        getBannedMembers().then(({ banned }) => {
            if (!cancelled) setBanned(banned);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className={styles.page}>
            <h1>Заблокированные</h1>
            <p className={styles.lead}>
                Список банов сервера — модератор и дата известны только для банов через бота, остальное помечено
                прочерком.
            </p>
            {banned && (
                <DataTable
                    columns={COLUMNS}
                    rows={banned}
                    getRowId={m => m.id}
                    searchPlaceholder="Поиск по имени"
                    searchKeys={m => [m.username, m.globalName ?? '', m.reason ?? '']}
                    emptyMessage="Банов нет."
                />
            )}
        </div>
    );
}
