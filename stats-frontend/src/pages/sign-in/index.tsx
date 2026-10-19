import { Link } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import { MatchPreview } from '../../widgets/match-preview';
import { RiotSignInButton } from '../../features/riot-sign-in/RiotSignInButton';
import styles from './index.module.scss';

// Дисклеймер — обязательный пункт политик Riot Developer Portal
// (developer.riotgames.com/policies/general). Раньше жил в
// widgets/sign-in-panel; та карточка-панель исчезла, когда вариант G
// заменил её прямой двухколоночной раскладкой без отдельного "glass"-
// контейнера, текст переехал сюда вместе с остальным левым столбцом.
const RIOT_DISCLAIMER =
    "Extree Stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing VALORANT. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc.";

export function SignInPage() {
    return (
        <div className={styles.page}>
            <SiteHeader rightSlot={<Link to="/terms">Terms of Use</Link>} />
            <main className={styles.main}>
                <div className={styles.left}>
                    <h1 className={styles.title}>
                        Track your game.
                        <br />
                        <span className={styles.hl}>Match by match.</span>
                    </h1>
                    <p className={styles.lead}>
                        Match history, win rates by map and agent, and rank progress — sign in with your Riot account
                        to see your own stats.
                    </p>
                    <RiotSignInButton />
                    <p className={styles.disclaimer}>{RIOT_DISCLAIMER}</p>
                </div>
                <MatchPreview />
            </main>
        </div>
    );
}
