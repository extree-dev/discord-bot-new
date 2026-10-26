import styles from './index.module.scss';

interface ActivityRow {
    map: string;
    mode: string;
    agent: string;
    kda: string;
    timeAgo: string;
    result: 'win' | 'loss';
}

// Мок-данные — реальная активность появится только после того, как Riot
// выдаст RSO-доступ (см. features/riot-sign-in/RiotSignInButton). "N ago"
// вместо даты — подчёркивает, что это живой feed, а не статический отчёт;
// "Preview" в шапке и бейдж "Sign in to see your real activity" честно
// обозначают, что это мок, а не реальные данные пользователя.
const MOCK_ACTIVITY: ActivityRow[] = [
    { map: 'Ascent', mode: 'Competitive', agent: 'Jett', kda: '24 / 11 / 6', timeAgo: '41m ago', result: 'win' },
    { map: 'Bind', mode: 'Competitive', agent: 'Omen', kda: '14 / 18 / 9', timeAgo: '1h ago', result: 'loss' },
    { map: 'Haven', mode: 'Unrated', agent: 'Sova', kda: '19 / 9 / 12', timeAgo: '2h ago', result: 'win' },
    { map: 'Split', mode: 'Competitive', agent: 'Jett', kda: '21 / 13 / 4', timeAgo: '3h ago', result: 'win' },
];

export function ActivityFeed() {
    return (
        <aside className={styles.card}>
            <div className={styles.head}>
                <span className={styles.t}>Activity</span>
                <span className={styles.t2}>
                    <span className={styles.dot} aria-hidden="true" />
                    Preview
                </span>
            </div>

            <div className={styles.timeline}>
                {MOCK_ACTIVITY.map(row => (
                    <div
                        key={`${row.map}-${row.agent}`}
                        className={
                            row.result === 'loss' ? `${styles.item} ${styles.loss}` : `${styles.item} ${styles.win}`
                        }
                    >
                        <span className={styles.node} aria-hidden="true">
                            <span className={styles.nodeDot} />
                        </span>
                        <div className={styles.row}>
                            <span className={styles.name}>
                                {row.result === 'win' ? 'Won' : 'Lost'} on {row.map}
                            </span>
                            <span className={styles.time}>{row.timeAgo}</span>
                        </div>
                        <div className={styles.sub}>
                            {row.mode} · {row.agent}
                        </div>
                        <div className={styles.meta}>
                            <span className={styles.kda}>{row.kda}</span>
                            <span className={styles.chip}>{row.result === 'win' ? 'WIN' : 'LOSS'}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.unlockLine}>
                <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                >
                    <rect x="4" y="11" width="16" height="9" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Sign in to see your real activity
            </div>
        </aside>
    );
}
