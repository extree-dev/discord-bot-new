import { useEffect, useState } from 'react';
import { getMutedMembers } from '../../entities/guild-members/api';
import type { MutedMember } from '../../entities/guild-members/types';
import { Avatar } from '../../shared/ui/Avatar';
import { DataTable, type DataTableColumn } from '../../shared/ui/DataTable';
import styles from '../guild-members/MembersPage.module.css';

const FALLBACK_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

function formatRemaining(expiresAt: number | null): string {
    if (!expiresAt) return '—';
    const ms = expiresAt - Date.now();
    if (ms <= 0) return 'истекает';
    const hours = Math.floor(ms / 3_600_000);
    if (hours >= 24) return `${Math.floor(hours / 24)} дн.`;
    if (hours >= 1) return `${hours} ч.`;
    return `${Math.max(1, Math.floor(ms / 60_000))} мин.`;
}

const COLUMNS: DataTableColumn<MutedMember>[] = [
    {
        key: 'user',
        label: 'Участник',
        sortable: true,
        sortValue: m => (m.globalName ?? m.username ?? m.id).toLowerCase(),
        render: m => (
            <div className={styles.userCell}>
                <Avatar src={m.avatarUrl ?? FALLBACK_AVATAR} alt="" size="tiny" />
                <div className={styles.userText}>
                    <span className={styles.userName}>{m.globalName ?? m.username ?? m.id}</span>
                    {m.username && <span className={styles.userHandle}>@{m.username}</span>}
                </div>
            </div>
        ),
    },
    { key: 'reason', label: 'Причина', render: m => m.reason ?? '—' },
    {
        key: 'mutedAt',
        label: 'Когда',
        sortable: true,
        sortValue: m => m.mutedAt ?? 0,
        render: m => (m.mutedAt ? new Date(m.mutedAt).toLocaleString('ru-RU') : '—'),
    },
    {
        key: 'expiresAt',
        label: 'Осталось',
        sortable: true,
        sortValue: m => m.expiresAt ?? 0,
        render: m => formatRemaining(m.expiresAt),
    },
];

// Гейт — в AdminShell. "В муте" — кастомный мут этого бота (роль Muted,
// см. moderation/), не нативный Discord timeout — см. GET /api/muted-members.
export function MutedPage() {
    const [muted, setMuted] = useState<MutedMember[] | null>(null);

    useEffect(() => {
        document.title = 'В муте — Extree';
        let cancelled = false;
        getMutedMembers().then(({ muted }) => {
            if (!cancelled) setMuted(muted);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className={styles.page}>
            <h1>В муте</h1>
            <p className={styles.lead}>Участники с активным мутом — снимается автоматически по истечении срока.</p>
            {muted && (
                <DataTable
                    columns={COLUMNS}
                    rows={muted}
                    getRowId={m => m.id}
                    searchPlaceholder="Поиск по имени"
                    searchKeys={m => [m.username ?? '', m.globalName ?? '', m.reason ?? '']}
                    emptyMessage="Сейчас никто не в муте."
                />
            )}
        </div>
    );
}
