import { Link } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { Button } from '../../shared/ui/Button';
import { useAuth } from '../../shared/auth/useAuth';
import { Skeleton } from '../../shared/ui/Skeleton';
import styles from './index.module.scss';

// Личный кабинет пользователя — не профиль игрока, а "хаб":
//   - ссылки на настройки/безопасность (там всё 2FA, пароли, сессии)
//   - сохранённые игроки (пока пусто — задел на будущее)
//   - быстрый переход к поиску игрока на публичной витрине
// Публичная статистика живёт в /player/:game/:riotId — там же
// ищутся чужие ники без логина.
export function AccountPage() {
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
        return (
            <DashboardShell user={null} title="">
                <Skeleton width={320} height={34} radius={6} />
            </DashboardShell>
        );
    }

    return (
        <DashboardShell
            user={{ email: user.email, isAdmin: user.isAdmin }}
            title={`Welcome back, ${user.nickname || user.name || user.email.split('@')[0]}`}
            subtitle="Your dashboard — jump into a search or manage your account."
            wide
        >
            <div className={styles.page}>
                <div className={styles.hubGrid}>
                    <Panel title="Public stats">
                        <h3 className={styles.cardTitle}>Look up any player</h3>
                        <p className={styles.cardText}>
                            Search any player across supported games. No login required — public stats live on the site.
                        </p>
                        <div className={styles.cardActions}>
                            <Button href="/" variant="flat" size="sm">
                                Open tracker
                            </Button>
                            <Button href="/valorant" variant="ghost" size="sm">
                                VALORANT
                            </Button>
                        </div>
                    </Panel>

                    <Panel title="Security">
                        <h3 className={styles.cardTitle}>Account &amp; security</h3>
                        <p className={styles.cardText}>Password, email, 2FA, recovery codes, and active sessions.</p>
                        <div className={styles.cardActions}>
                            <Button href="/account/settings?tab=security" variant="flat" size="sm">
                                Open security
                            </Button>
                        </div>
                    </Panel>

                    <Panel title="Linked accounts">
                        <h3 className={styles.cardTitle}>Riot &amp; Discord</h3>
                        <p className={styles.cardText}>
                            Link your Riot account to unlock match stats once Riot approves full API access for Extree
                            Stats.
                        </p>
                        <div className={styles.cardActions}>
                            <Button href="/account/riot-profile" variant="flat" size="sm">
                                Riot profile
                            </Button>
                            <Button href="/account/settings" variant="ghost" size="sm">
                                Settings
                            </Button>
                        </div>
                    </Panel>

                    <Panel title="Saved players">
                        <h3 className={styles.cardTitle}>Nothing saved yet</h3>
                        <p className={styles.emptyNote}>
                            Players you save from public profiles will appear here — a quick way to follow your own
                            stats or your squad.
                        </p>
                    </Panel>
                </div>

                <Panel title="Recent activity">
                    <p className={styles.emptyNote}>
                        Once match data is live, this section will show your latest searches and saved players. For now,
                        use the public tracker to explore.
                    </p>
                    <div className={styles.cardActions} style={{ marginTop: 12 }}>
                        <Link to="/support">
                            <Button variant="ghost" size="sm">
                                Contact support
                            </Button>
                        </Link>
                    </div>
                </Panel>
            </div>
        </DashboardShell>
    );
}
