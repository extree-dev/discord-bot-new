import { RiotSignInButton } from '../../features/riot-sign-in/RiotSignInButton';
import styles from './index.module.scss';

// Текст — обязательный дисклеймер из общих политик Riot Developer Portal
// (developer.riotgames.com/policies/general): любой продукт на их API
// должен хорошо заметно показывать, что он не одобрен Riot Games, плюс
// trademark-нотис. Логотип Riot/VALORANT не используем — их политика
// прямо просит сторонние продукты не брать их товарные знаки как есть,
// только текстовое упоминание.
const RIOT_DISCLAIMER =
    "Extree Stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing VALORANT. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc.";

export function SignInPanel() {
    return (
        <div className={styles.wrap}>
            <div className={styles.panel}>
                <div className={styles.accentLine} aria-hidden="true" />
                <span className={styles.eyebrow}>Extree Stats</span>
                <h1 className={styles.title}>Track your game</h1>
                <p className={styles.lead}>
                    Match history, win rates by map and agent, and rank progress — sign in with your Riot account to see
                    your own stats.
                </p>
                <RiotSignInButton />
            </div>
            <p className={styles.disclaimer}>{RIOT_DISCLAIMER}</p>
        </div>
    );
}
