import { Link } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import { ActivityFeed } from '../../widgets/activity-feed';
import { RiotSignInButton } from '../../features/riot-sign-in/RiotSignInButton';
import styles from './index.module.scss';

// Дисклеймер — обязательный пункт политик Riot Developer Portal
// (developer.riotgames.com/policies/general).
const RIOT_DISCLAIMER =
    "Extree Stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing VALORANT. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc.";

export function SignInPage() {
    return (
        <div className={styles.page}>
            <div className={styles.ambient} aria-hidden="true" />
            <SiteHeader
                rightSlot={
                    <>
                        <Link to="/privacy">Privacy Policy</Link>
                        <span aria-hidden="true"> · </span>
                        <Link to="/terms">Terms of Use</Link>
                        <span aria-hidden="true"> · </span>
                        <Link to="/login">Log in</Link>
                    </>
                }
            />
            <main className={styles.main}>
                <div className={styles.left}>
                    <div className={styles.badge}>
                        <span className={styles.pulse} aria-hidden="true" />
                        <span>RSO integration — in review with Riot Games</span>
                    </div>
                    <h1 className={styles.title}>
                        Every match, <span className={styles.accentText}>broken down</span> the way you&apos;d actually
                        read it.
                    </h1>
                    <p className={styles.lead}>
                        Win rates by map and agent, K/D trends, and rank progress — sign in with your Riot account and
                        see your own numbers.
                    </p>
                    <RiotSignInButton />
                    <p className={styles.altAuth}>
                        Prefer email? <Link to="/register">Create an account</Link>
                    </p>
                    <p className={styles.disclaimer}>{RIOT_DISCLAIMER}</p>
                </div>
                <ActivityFeed />
            </main>
        </div>
    );
}
