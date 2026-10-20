import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../../widgets/auth-card';
import { getAccount, type AccountUser } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

// Тот же дисклеймер, что на sign-in и terms (developer.riotgames.com/
// policies/general, "Legal Jibber Jabber") — здесь он нужен отдельно, т.к.
// это единственное другое место в продукте с явным Riot-брендированным CTA.
const RIOT_DISCLAIMER =
    "Extree Stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing VALORANT. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc.";

export function AccountPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState<AccountUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getAccount().then(result => {
            if (cancelled) return;
            if (!result) {
                navigate('/login');
                return;
            }
            setUser(result);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [navigate]);

    if (loading || !user) {
        return <AuthCard title="Your account">Loading…</AuthCard>;
    }

    return (
        <AuthCard title="Your account">
            {user.name && (
                <div className={styles.row}>
                    <span className={styles.label}>Name</span>
                    <span className={styles.value}>{user.name}</span>
                </div>
            )}
            {user.nickname && (
                <div className={styles.row}>
                    <span className={styles.label}>Nickname</span>
                    <span className={styles.value}>{user.nickname}</span>
                </div>
            )}
            <div className={styles.row}>
                <span className={styles.label}>Email</span>
                <span className={styles.value}>{user.email}</span>
            </div>

            {/* Riot-привязка — будущая функция (см. riot_puuid/riot_linked_at в
                stats-backend/db.js), пока RSO недоступен (Riot ещё не одобрил
                продукт) кнопка честно отключена, а не притворяется рабочей. */}
            <div className={styles.riotCard}>
                <div className={styles.riotCardTitle}>Riot account</div>
                <div className={styles.riotCardDesc}>
                    Not connected yet — this is coming once Riot Sign-On is live for Extree Stats.
                </div>
                <button type="button" className={styles.riotCardButton} disabled>
                    Connect Riot account — coming soon
                </button>
                <p className={styles.riotDisclaimer}>{RIOT_DISCLAIMER}</p>
            </div>

            <Link className={styles.logout} to="/support">
                Contact support
            </Link>
            <a className={styles.logout} href="/auth/logout">
                Sign out
            </a>
        </AuthCard>
    );
}
