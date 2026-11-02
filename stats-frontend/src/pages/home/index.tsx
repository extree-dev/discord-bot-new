import { Link } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import { GAMES } from '../../shared/config/games';
import styles from './index.module.scss';

const GAME_COVERS: Record<string, string> = {
    cs2: '/games/cs2/cover.jpg',
    dota2: '/games/dota2/cover.jpg',
    apex: '/games/apex/cover.jpg',
    valorant: '/games/valorant/cover.jpg',
    lol: '/games/lol/cover.png',
    fortnite: '/games/fortnite/cover.jpg',
    cod: '/games/cod/cover.jpg',
};

export function HomePage() {
    // Гарантируем, что COD точно будет на главной
    const displayGames = [...GAMES];
    if (!displayGames.find(g => g.slug === 'cod')) {
        displayGames.push({
            slug: 'cod',
            name: 'Call of Duty',
            shortName: 'COD',
            description: 'Modern warfare multiplayer and Warzone stats.',
            accent: '#a3a3a3',
            status: 'pending_api',
            background: '/games/cod/background.webp',
        });
    }

    return (
        <div className={styles.page}>
            <SiteHeader />

            <div className={styles.layout}>
                {/* ЛЕВАЯ ПАНЕЛЬ (Sticky) */}
                <aside className={styles.sidebar}>
                    <h1 className={styles.sidebarTitle}>
                        Precision
                        <br />
                        <span className={styles.sidebarHl}>Analytics</span> for
                        <br />
                        Competitive Play.
                    </h1>
                    <p className={styles.sidebarLead}>
                        Deep dive into match histories, track your win rates by map, and monitor your rank progression.
                        Built for players who want the full picture.
                    </p>

                    <div className={styles.sidebarBottom}>
                        <div className={styles.socials}>
                            <a
                                href="https://t.me/extreetech"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Telegram"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                </svg>
                            </a>
                            <a
                                href="https://x.com/extreetech"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="X (Twitter)"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 3.918H5.062z" />
                                </svg>
                            </a>
                            <a
                                href="https://instagram.com/theromkaa"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Instagram"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
                                </svg>
                            </a>
                        </div>

                        <div className={styles.footerLinks}>
                            <Link to="/privacy">Privacy Policy</Link>
                            <Link to="/terms">Terms of Service</Link>
                            <Link to="/cookies">Cookie Policy</Link>
                            <Link to="/support">Support</Link>
                        </div>

                        <div className={styles.copyright}>© {new Date().getFullYear()} Extree Stats.</div>
                    </div>
                </aside>

                {/* ПРАВАЯ ПАНЕЛЬ (Скроллится) */}
                <main className={styles.mainContent}>
                    <div className={styles.mainHeader}>
                        <h2 className={styles.mainTitle}>Supported Games</h2>
                        <span className={styles.sortText}>Sort by Popularity ▾</span>
                    </div>

                    <div className={styles.gameGrid}>
                        {displayGames.map(game => {
                            const coverUrl = GAME_COVERS[game.slug];
                            const isNew = game.slug === 'valorant';

                            return (
                                <Link key={game.slug} to={`/${game.slug}`} className={styles.gameCardWrapper}>
                                    <div className={styles.gameCardImageBox}>
                                        {coverUrl ? (
                                            <img src={coverUrl} alt={game.name} loading="lazy" />
                                        ) : (
                                            <div className={styles.gameCardPlaceholder}>
                                                <span>{game.name}</span>
                                            </div>
                                        )}

                                        {isNew && <span className={styles.gameBadge}>NEW</span>}
                                        {game.status === 'pending_api' && !isNew && (
                                            <span className={`${styles.gameBadge} ${styles.gameBadgePending}`}>
                                                Preview
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.gameCardTitle}>{game.name}</div>
                                </Link>
                            );
                        })}
                    </div>
                </main>
            </div>
        </div>
    );
}
