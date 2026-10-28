import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { useAuth } from '../../shared/auth/useAuth';
import { Skeleton } from '../../shared/ui/Skeleton';
import styles from './index.module.scss';

// SVG иконки (без изменений)
function ChartIcon() {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
    );
}
function TargetIcon() {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
        </svg>
    );
}
function DiscordIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
        </svg>
    );
}

// SRP: только рендер страницы. Данные — из useAuth (не делаем getAccount()).
// ProtectedRoute гарантирует, что user !== null и status === 'authenticated'.
export function AccountPage() {
    const navigate = useNavigate();
    const { user, banned } = useAuth();

    if (banned) {
        return (
            <DashboardShell user={null} title="Account banned">
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <h2>Your account has been banned.</h2>
                    <p>
                        Please contact <a href="mailto:support@extree.tech">support@extree.tech</a>.
                    </p>
                </div>
            </DashboardShell>
        );
    }

    if (!user) {
        // ProtectedRoute уже редиректит анонимных — сюда не должны попасть,
        // этот кадр виден максимум один тик, пока резолвится auth-статус.
        return (
            <DashboardShell user={null} title="">
                <div className={styles.headerRow}>
                    <Skeleton width={320} height={34} radius={6} />
                    <Skeleton width={140} height={40} radius={6} />
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell user={{ email: user.email, isAdmin: user.isAdmin }} title="" wide>
            <div className={styles.page}>
                <div className={styles.headerRow}>
                    <div className={styles.headerText}>
                        <div className={styles.statusBadge}>
                            <span className={styles.statusDot}></span>
                            Waiting for Riot Approval
                        </div>
                        <h1 className={styles.heroTitle}>
                            Your VALORANT <span className={styles.textRed}>Journey Starts Here.</span>
                        </h1>
                        <p className={styles.heroSubtitle}>
                            We are currently in the final stages of development and waiting for Riot Games to approve
                            our API access. Soon, you&apos;ll be able to link your Riot account to view your match
                            history, K/D trends, and detailed stats.
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        <button className={styles.primaryBtn} disabled>
                            Connect Riot Account
                        </button>
                        <button className={styles.secondaryBtn} onClick={() => navigate('/support')}>
                            Contact Support
                        </button>
                    </div>
                </div>

                <div className={styles.featuresGrid}>
                    <div className={styles.featureCard}>
                        <div className={styles.iconWrapper}>
                            <ChartIcon />
                        </div>
                        <h3>Deep Statistics</h3>
                        <p>Track your K/D ratio, headshot percentage, and win rate across all your matches.</p>
                    </div>
                    <div className={styles.featureCard}>
                        <div className={styles.iconWrapper}>
                            <TargetIcon />
                        </div>
                        <h3>Match History</h3>
                        <p>Detailed round-by-round breakdowns of your recent VALORANT matches.</p>
                    </div>
                    <div className={styles.featureCard}>
                        <div className={styles.iconWrapper}>
                            <DiscordIcon />
                        </div>
                        <h3>Discord Integration</h3>
                        <p>Link your Extree Stats profile to our Discord bot for live match updates.</p>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
