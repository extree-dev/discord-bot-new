import { useEffect, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import { SmartSearchBar } from '../../shared/ui/SmartSearchBar';
import { Button } from '../../shared/ui/Button';
import { DemoDashboard } from '../../widgets/demo-dashboard';
import { GAMES } from '../../shared/config/games';
import { AUTH_CONFIG } from '../../shared/config/authConfig';
import styles from './index.module.scss';

export function GameHubPage() {
    const { slug } = useParams<{ slug: string }>();

    // Ищем игру. Если не нашли — создаем фоллбек.
    // ВАЖНО: Обернуто в useMemo для стабильности ссылки.
    const game = useMemo(() => {
        if (!slug) return undefined;
        return (
            GAMES.find(g => g.slug === slug) || {
                slug: slug,
                name: slug.toUpperCase(),
                shortName: slug.toUpperCase(),
                description: 'Game stats',
                accent: '#ffffff',
                status: 'pending_api',
                background: `/games/${slug}/background.webp`,
            }
        );
    }, [slug]);

    const auth = game ? AUTH_CONFIG[game.slug] || AUTH_CONFIG['valorant'] : AUTH_CONFIG['valorant'];

    useEffect(() => {
        if (game?.accent) {
            document.documentElement.style.setProperty('--game-accent', game.accent);
            document.documentElement.style.setProperty('--accent', game.accent);

            const hex = game.accent.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16) || 0;
            const g = parseInt(hex.substring(2, 4), 16) || 0;
            const b = parseInt(hex.substring(4, 6), 16) || 0;
            const yiq = (r * 299 + g * 587 + b * 114) / 1000;
            document.documentElement.style.setProperty('--accent-text', yiq >= 128 ? '#000000' : '#ffffff');
        }
        return () => {
            document.documentElement.style.removeProperty('--game-accent');
            document.documentElement.style.removeProperty('--accent');
            document.documentElement.style.removeProperty('--accent-text');
        };
    }, [game]);

    if (!game) return <Navigate to="/" replace />;

    return (
        <div className={styles.page} style={{ backgroundImage: `url(${game.background})` }}>
            <SiteHeader />

            <section className={styles.gameHero}>
                <div className={styles.heroContent}>
                    <div className={styles.heroLeft}>
                        <div className={styles.gameTitleWrap}>
                            <h1 className={styles.gameTitle}>
                                {game.name} <span>STATS</span>
                            </h1>
                            <p className={styles.gameSubtitle}>Check Detailed {game.name} Stats and Leaderboards</p>
                        </div>

                        <div className={styles.searchWrap}>
                            <SmartSearchBar gameSlug={game.slug} />
                        </div>

                        <div className={styles.tabsRow}>
                            <button className={`${styles.tabBtn} ${styles.tabActive}`}>
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                Recent
                            </button>
                            <button className={styles.tabBtn}>
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                Favorites
                            </button>
                            <button className={styles.tabBtn}>
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                Results
                            </button>
                        </div>
                        <div className={styles.emptyRecent}>No recent players to show.</div>

                        <div className={styles.divider}>
                            <span>Or sign in with</span>
                        </div>

                        <Button
                            href={`/auth/${auth.name.toLowerCase()}/login`}
                            variant="ghost"
                            fullWidth
                            className={styles.riotBtn}
                        >
                            <img src={auth.icon} alt={auth.name} width="20" height="20" style={{ marginRight: 8 }} />
                            {auth.label}
                        </Button>
                        <p className={styles.legalText}>
                            *By signing in you acknowledge that your profile becomes public.{' '}
                            <Link to="/privacy">Make private</Link>.
                        </p>
                    </div>

                    <div className={styles.heroRight}>
                        <div className={styles.promoBanner}>
                            <div className={styles.promoBadge}>DEMO PREVIEW</div>
                            <h2>See how it works.</h2>
                            <p>
                                This is a live preview of the dashboard. Real stats will populate once API access is
                                granted.
                            </p>

                            <div className={styles.dashboardWrapper}>
                                <div className={styles.dashboardScale}>
                                    <DemoDashboard gameSlug={game.slug} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
