import { useEffect, useMemo, useState } from 'react';
import { getMutedMembers } from '../../entities/guild-members/api';
import type { MutedMember } from '../../entities/guild-members/types';
import { useLang } from '../../shared/lib/useLang';
import type { TranslationKey } from '../../shared/lib/i18n/translations';
import { Avatar } from '../../shared/ui/Avatar';
import { DataTable, type DataTableColumn } from '../../shared/ui/DataTable';
import styles from '../guild-members/MembersPage.module.css';

const FALLBACK_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

function formatRemaining(expiresAt: number | null, t: (key: TranslationKey) => string): string {
    if (!expiresAt) return '—';
    const ms = expiresAt - Date.now();
    if (ms <= 0) return t('muted.expiring');
    const hours = Math.floor(ms / 3_600_000);
    if (hours >= 24) return `${Math.floor(hours / 24)} ${t('muted.unitDays')}`;
    if (hours >= 1) return `${hours} ${t('muted.unitHours')}`;
    return `${Math.max(1, Math.floor(ms / 60_000))} ${t('muted.unitMinutes')}`;
}

function buildColumns(t: (key: TranslationKey) => string): DataTableColumn<MutedMember>[] {
    return [
        {
            key: 'user',
            label: t('members.colUser'),
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
        { key: 'reason', label: t('muted.colReason'), render: m => m.reason ?? '—' },
        {
            key: 'mutedAt',
            label: t('muted.colWhen'),
            sortable: true,
            sortValue: m => m.mutedAt ?? 0,
            render: m => (m.mutedAt ? new Date(m.mutedAt).toLocaleString('ru-RU') : '—'),
        },
        {
            key: 'expiresAt',
            label: t('muted.colLeft'),
            sortable: true,
            sortValue: m => m.expiresAt ?? 0,
            render: m => formatRemaining(m.expiresAt, t),
        },
    ];
}

// Гейт — в AdminShell. "В муте" — кастомный мут этого бота (роль Muted,
// см. moderation/), не нативный Discord timeout — см. GET /api/muted-members.
export function MutedPage() {
    const [muted, setMuted] = useState<MutedMember[] | null>(null);
    const { lang, t } = useLang();

    useEffect(() => {
        document.title = `${t('muted.title')} — Extree`;
    }, [lang, t]);

    useEffect(() => {
        let cancelled = false;
        getMutedMembers().then(({ muted }) => {
            if (!cancelled) setMuted(muted);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const columns = useMemo(() => buildColumns(t), [t]);

    return (
        <div className={styles.page}>
            <h1>{t('muted.title')}</h1>
            <p className={styles.lead}>{t('muted.lead')}</p>
            {muted && (
                <DataTable
                    columns={columns}
                    rows={muted}
                    getRowId={m => m.id}
                    searchPlaceholder={t('members.searchPlaceholder')}
                    searchKeys={m => [m.username ?? '', m.globalName ?? '', m.reason ?? '']}
                    emptyMessage={t('muted.empty')}
                />
            )}
        </div>
    );
}
