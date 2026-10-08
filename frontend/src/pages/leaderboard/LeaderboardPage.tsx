import { useEffect, useMemo, useState } from 'react';
import { getLeaderboard } from '../../entities/guild-members/api';
import type { LeaderboardEntry } from '../../entities/guild-members/types';
import { useLang } from '../../shared/lib/useLang';
import type { TranslationKey } from '../../shared/lib/i18n/translations';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { DataTable, type DataTableColumn } from '../../shared/ui/DataTable';
import styles from '../guild-members/MembersPage.module.css';

const FALLBACK_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

function buildColumns(t: (key: TranslationKey) => string): DataTableColumn<LeaderboardEntry>[] {
    return [
        {
            key: 'rank',
            label: t('leaderboard.colRank'),
            sortable: true,
            sortValue: e => e.rank,
            render: e => <span>{e.rank}</span>,
        },
        {
            key: 'user',
            label: t('leaderboard.colUser'),
            sortable: true,
            sortValue: e => (e.globalName ?? e.username ?? e.id).toLowerCase(),
            render: e => (
                <div className={styles.userCell}>
                    <Avatar src={e.avatarUrl ?? FALLBACK_AVATAR} alt="" size="tiny" />
                    <div className={styles.userText}>
                        <span className={styles.userName}>{e.globalName ?? e.username ?? e.id}</span>
                        {e.username && <span className={styles.userHandle}>@{e.username}</span>}
                    </div>
                </div>
            ),
        },
        {
            key: 'score',
            label: t('leaderboard.colScore'),
            sortable: true,
            sortValue: e => e.score,
            render: e => e.score.toLocaleString('ru-RU'),
        },
        {
            key: 'messageCount',
            label: t('leaderboard.colMessages'),
            sortable: true,
            sortValue: e => e.messageCount,
            render: e => e.messageCount.toLocaleString('ru-RU'),
        },
        {
            key: 'voiceMinutes',
            label: t('leaderboard.colVoice'),
            sortable: true,
            sortValue: e => e.voiceMinutes,
            render: e => e.voiceMinutes.toLocaleString('ru-RU'),
        },
        {
            key: 'prestige',
            label: t('leaderboard.colPrestige'),
            sortable: true,
            sortValue: e => e.prestige,
            render: e => (e.prestige > 0 ? <Badge variant="accent">★ {e.prestige}</Badge> : '—'),
        },
    ];
}

// Гейт — в AdminShell. Та же сортировка, что у /level leaderboard в
// Discord (leveling.getLeaderboard) — см. GET /api/leaderboard.
export function LeaderboardPage() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
    const { lang, t } = useLang();

    useEffect(() => {
        document.title = `${t('leaderboard.title')} — Extree`;
    }, [lang, t]);

    useEffect(() => {
        let cancelled = false;
        getLeaderboard().then(({ leaderboard }) => {
            if (!cancelled) setLeaderboard(leaderboard);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const columns = useMemo(() => buildColumns(t), [t]);

    return (
        <div className={styles.page}>
            <h1>{t('leaderboard.title')}</h1>
            <p className={styles.lead}>{t('leaderboard.lead')}</p>
            {leaderboard && (
                <DataTable
                    columns={columns}
                    rows={leaderboard}
                    getRowId={e => e.id}
                    searchPlaceholder={t('members.searchPlaceholder')}
                    searchKeys={e => [e.username ?? '', e.globalName ?? '']}
                    emptyMessage={t('leaderboard.empty')}
                />
            )}
        </div>
    );
}
