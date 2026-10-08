import { useEffect, useMemo, useState } from 'react';
import { getBannedMembers } from '../../entities/guild-members/api';
import type { BannedMember } from '../../entities/guild-members/types';
import { useLang } from '../../shared/lib/useLang';
import type { TranslationKey } from '../../shared/lib/i18n/translations';
import { Avatar } from '../../shared/ui/Avatar';
import { DataTable, type DataTableColumn } from '../../shared/ui/DataTable';
import styles from '../guild-members/MembersPage.module.css';

function buildColumns(t: (key: TranslationKey) => string): DataTableColumn<BannedMember>[] {
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
        { key: 'reason', label: t('banned.colReason'), render: m => m.reason ?? '—' },
        { key: 'moderatorTag', label: t('banned.colModerator'), render: m => m.moderatorTag ?? '—' },
        {
            key: 'bannedAt',
            label: t('banned.colWhen'),
            sortable: true,
            sortValue: m => (m.bannedAt ? new Date(m.bannedAt).getTime() : 0),
            render: m => (m.bannedAt ? new Date(m.bannedAt).toLocaleString('ru-RU') : '—'),
        },
    ];
}

// Гейт — в AdminShell. Живой список банов от Discord, дополненный
// модератором/датой из собственного журнала /ban там, где это есть —
// см. GET /api/banned-members.
export function BannedPage() {
    const [banned, setBanned] = useState<BannedMember[] | null>(null);
    const { lang, t } = useLang();

    useEffect(() => {
        document.title = `${t('banned.title')} — Extree`;
    }, [lang, t]);

    useEffect(() => {
        let cancelled = false;
        getBannedMembers().then(({ banned }) => {
            if (!cancelled) setBanned(banned);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const columns = useMemo(() => buildColumns(t), [t]);

    return (
        <div className={styles.page}>
            <h1>{t('banned.title')}</h1>
            <p className={styles.lead}>{t('banned.lead')}</p>
            {banned && (
                <DataTable
                    columns={columns}
                    rows={banned}
                    getRowId={m => m.id}
                    searchPlaceholder={t('members.searchPlaceholder')}
                    searchKeys={m => [m.username, m.globalName ?? '', m.reason ?? '']}
                    emptyMessage={t('banned.empty')}
                />
            )}
        </div>
    );
}
