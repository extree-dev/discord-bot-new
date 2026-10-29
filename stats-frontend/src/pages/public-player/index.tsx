import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import { getGame } from '../../shared/config/games';
import { lookupRiotId, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

type Tab = 'overview' | 'matches' | 'agents';

interface PlayerState {
    status: 'loading' | 'found' | 'not_found' | 'error';
    gameName?: string;
    tagLine?: string;
    error?: string;
}

export function PublicPlayerPage() {
    const { game: gameSlug, riotId } = useParams<{ game: string; riotId: string }>();
    const game = gameSlug ? getGame(gameSlug) : undefined;
    const [tab, setTab] = useState<Tab>('overview');
    const [player, setPlayer] = useState<PlayerState>({ status: 'loading' });

    useEffect(() => {
        if (!game || !riotId) return;
        if (game.slug !== 'valorant') {
            setPlayer({ status: 'not_found', error: 'This game is not available yet.' });
            return;
        }

        let cancelled = false;
        setPlayer({ status: 'loading' });

        lookupRiotId(decodeURIComponent(riotId))
            .then(res => {
                if (cancelled) return;
                setPlayer({ status: 'found', gameName: res.gameName, tagLine: res.tagLine });
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setPlayer({
                    status: 'error',
                    error: err instanceof ApiError ? err.message : 'Could not look up this player.',
                });
            });

        return () => {
            cancelled = true;
        };
    }, [game, riotId]);

    if (!game || !riotId) return <Navigate to="/" replace />;

    const displayName = player.gameName ?? decodeURIComponent(riotId).split('#')[0];
    const displayTag = player.tagLine ?? decodeURIComponent(riotId).split('#')[1] ?? '';
    const initial = displayName.slice(0, 1).toUpperCase();

    // Заглушки статов — в будущем заменятся реальными данными API
    const statPlaceholders = [
        { label: 'K/D Ratio', value: '—' },
        { label: 'Win Rate', value: '—' },
        { label: 'Headshot %', value: '—' },
        { label: 'Current Rank', value: '—' },
        { label: 'Matches', value: '—' },
        { label: 'Hours', value: '—' },
    ];

    return (
        <div className={styles.page}>
            <SiteHeader showSearch />

            <div className={styles.container}>
                <Link to={`/${game.slug}`} className={styles.breadcrumb}>
                    ← {game.name}
                </Link>

                <div className={styles.header}>
                    <div className={styles.avatar}>{initial}</div>
                    <div className={styles.headerText}>
                        <h1 className={styles.name}>
                            {displayName}
                            {displayTag && <span className={styles.tag}>#{displayTag}</span>}
                        </h1>
                        <span className={styles.gameBadge}>
                            {game.shortName}
                            {player.status === 'found' && ' · Confirmed'}
                        </span>
                    </div>
                </div>

                {player.status === 'error' && <div className={styles.error}>{player.error}</div>}
                {player.status === 'loading' && <div className={styles.loading}>Looking up player…</div>}

                {player.status === 'found' && (
                    <>
                        <div className={styles.tabs}>
                            {(['overview', 'matches', 'agents'] as Tab[]).map(t => (
                                <button
                                    key={t}
                                    className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                                    onClick={() => setTab(t)}
                                >
                                    {t === 'overview' ? 'Overview' : t === 'matches' ? 'Matches' : 'Agents'}
                                </button>
                            ))}
                        </div>

                        <div className={styles.statsGrid}>
                            {statPlaceholders.map(s => (
                                <div key={s.label} className={styles.statCard}>
                                    <div className={styles.statLabel}>{s.label}</div>
                                    <div
                                        className={`${styles.statValue} ${s.value === '—' ? styles.statValueMuted : ''}`}
                                    >
                                        {s.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles.lockedBanner}>
                            <h3 className={styles.lockedTitle}>Stats are locked</h3>
                            <p className={styles.lockedText}>
                                Match history and detailed stats unlock automatically once Riot approves full API access
                                for Extree Stats. The account is already confirmed — nothing to do on your end.
                            </p>
                        </div>
                    </>
                )}

                {player.status === 'not_found' && (
                    <div className={styles.lockedBanner}>
                        <h3 className={styles.lockedTitle}>Player not found</h3>
                        <p className={styles.lockedText}>{player.error ?? 'Check the nickname and try again.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
