import styles from './index.module.scss';

interface MatchRow {
    map: string;
    mode: string;
    agent: string;
    kda: string;
    result: 'win' | 'loss';
}

// Мок-данные — реальная история матчей появится только после того, как
// Riot выдаст RSO-доступ (см. features/riot-sign-in/RiotSignInButton).
// Показываем ревьюерам Riot и будущим пользователям, как выглядит готовый
// продукт, пока сам вход не работает; размытая плашка "Sign in to see
// your matches" честно обозначает, что это превью, а не реальные данные.
const MOCK_MATCHES: MatchRow[] = [
    { map: 'Ascent', mode: 'Competitive', agent: 'Jett', kda: '24 / 11 / 6', result: 'win' },
    { map: 'Bind', mode: 'Competitive', agent: 'Omen', kda: '14 / 18 / 9', result: 'loss' },
    { map: 'Haven', mode: 'Unrated', agent: 'Sova', kda: '19 / 9 / 12', result: 'win' },
    { map: 'Split', mode: 'Competitive', agent: 'Jett', kda: '21 / 13 / 4', result: 'win' },
    { map: 'Icebox', mode: 'Competitive', agent: 'Sage', kda: '10 / 16 / 15', result: 'loss' },
];

export function MatchPreview() {
    return (
        <aside className={styles.right}>
            <div className={styles.tableHead}>
                <span className={styles.t}>Recent matches</span>
                <span className={styles.t2}>Last 24h</span>
            </div>

            {MOCK_MATCHES.map(row => (
                <div
                    key={`${row.map}-${row.agent}`}
                    className={row.result === 'loss' ? `${styles.match} ${styles.loss}` : styles.match}
                >
                    <div className={styles.map} aria-hidden="true" />
                    <div className={styles.info}>
                        <div className={styles.mapName}>
                            {row.map} · {row.mode}
                        </div>
                        <div className={styles.agent}>{row.agent}</div>
                    </div>
                    <div className={styles.kda}>{row.kda}</div>
                    <div className={styles.result}>{row.result === 'win' ? 'WIN' : 'LOSS'}</div>
                </div>
            ))}

            <div className={styles.unlock}>
                <div className={styles.unlockCard}>
                    <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ff4655"
                        strokeWidth="2"
                        aria-hidden="true"
                    >
                        <rect x="4" y="11" width="16" height="9" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                    <div className={styles.unlockTitle}>Sign in to see your matches</div>
                    <div className={styles.unlockDesc}>Data shown is a preview only</div>
                </div>
            </div>
        </aside>
    );
}
