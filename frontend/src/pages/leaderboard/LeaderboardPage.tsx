import { useEffect, useState } from 'react';
import { getLeaderboard } from '../../entities/guild-members/api';
import type { LeaderboardEntry } from '../../entities/guild-members/types';
import { Avatar } from '../../shared/ui/Avatar';
import { Badge } from '../../shared/ui/Badge';
import { DataTable, type DataTableColumn } from '../../shared/ui/DataTable';
import styles from '../guild-members/MembersPage.module.css';

const FALLBACK_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

const COLUMNS: DataTableColumn<LeaderboardEntry>[] = [
    {
        key: 'rank',
        label: '#',
        sortable: true,
        sortValue: e => e.rank,
        render: e => <span>{e.rank}</span>,
    },
    {
        key: 'user',
        label: 'Участник',
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
        label: 'Очки',
        sortable: true,
        sortValue: e => e.score,
        render: e => e.score.toLocaleString('ru-RU'),
    },
    {
        key: 'messageCount',
        label: 'Сообщений',
        sortable: true,
        sortValue: e => e.messageCount,
        render: e => e.messageCount.toLocaleString('ru-RU'),
    },
    {
        key: 'voiceMinutes',
        label: 'Голос, мин',
        sortable: true,
        sortValue: e => e.voiceMinutes,
        render: e => e.voiceMinutes.toLocaleString('ru-RU'),
    },
    {
        key: 'prestige',
        label: 'Престиж',
        sortable: true,
        sortValue: e => e.prestige,
        render: e => (e.prestige > 0 ? <Badge variant="accent">★ {e.prestige}</Badge> : '—'),
    },
];

// Гейт — в AdminShell. Та же сортировка, что у /level leaderboard в
// Discord (leveling.getLeaderboard) — см. GET /api/leaderboard.
export function LeaderboardPage() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);

    useEffect(() => {
        document.title = 'Уровни — Extree';
        let cancelled = false;
        getLeaderboard().then(({ leaderboard }) => {
            if (!cancelled) setLeaderboard(leaderboard);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className={styles.page}>
            <h1>Уровни</h1>
            <p className={styles.lead}>
                Рейтинг активности участников — та же логика, что у команды /level leaderboard.
            </p>
            {leaderboard && (
                <DataTable
                    columns={COLUMNS}
                    rows={leaderboard}
                    getRowId={e => e.id}
                    searchPlaceholder="Поиск по имени"
                    searchKeys={e => [e.username ?? '', e.globalName ?? '']}
                    emptyMessage="Пока никто не набрал очков."
                />
            )}
        </div>
    );
}
