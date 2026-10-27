import { useState, type FormEvent } from 'react';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { Skeleton } from '../../shared/ui/Skeleton';
import { ChartIcon, TargetIcon, ShieldIcon, LockIcon } from '../../shared/ui/Icons';
import { useAuth } from '../../shared/auth/useAuth';
import { lookupRiotId, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const RIOT_DISCLAIMER =
    "Extree Stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing VALORANT. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc.";

const LOCKED_STATS = [
    { label: 'K/D Ratio', icon: ChartIcon },
    { label: 'Win Rate', icon: TargetIcon },
    { label: 'Headshot %', icon: TargetIcon },
    { label: 'Current Rank', icon: ShieldIcon },
];

// Настоящая реализация "профиля игрока" (раньше кнопка "View Riot
// Profile" в Linked Accounts вела на /riot-lookup, который не
// подключён в App.tsx — см. комментарий там про RSO/VALORANT API
// Pending Review — мёртвая ссылка). Данные те же, что уже честно
// показывает /api/riot/lookup (account-v1: подтверждение, что аккаунт
// существует), просто оформлены как собственная страница профиля
// внутри панели управления, а не как отдельный публичный инструмент
// поиска. Матч-статистику не выдумываем — секция с ней заблокирована
// и так и подписана, пока Riot не одобрит полный доступ к API.
export function PlayerProfilePage() {
    const { user } = useAuth();
    const [riotId, setRiotId] = useState('');
    const [result, setResult] = useState<{ gameName: string; tagLine: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            const found = await lookupRiotId(riotId);
            setResult({ gameName: found.gameName, tagLine: found.tagLine });
        } catch (err) {
            setResult(null);
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    const dashUser = user ? { email: user.email, isAdmin: user.isAdmin } : null;

    return (
        <DashboardShell
            user={dashUser}
            breadcrumb={{ to: '/account/settings', label: 'Back to settings' }}
            title="Player Profile"
            subtitle="Confirm a Riot ID through Riot's API — full match stats unlock once Riot approves full access."
        >
            {!user ? (
                <Panel>
                    <div className={styles.skeletonRow}>
                        <Skeleton width={64} height={64} radius="50%" />
                        <Skeleton width={160} height={20} />
                    </div>
                </Panel>
            ) : (
                <>
                    <Panel
                        title="Look up a Riot ID"
                        subtitle="Enter a Riot ID to confirm it exists via Riot's account API."
                    >
                        <form className={styles.form} onSubmit={onSubmit}>
                            <TextField
                                id="riotId"
                                label="Riot ID"
                                type="text"
                                placeholder="Name#Tag"
                                required
                                value={riotId}
                                onChange={e => setRiotId(e.target.value)}
                            />
                            <Button type="submit" variant="flat" disabled={pending}>
                                {pending ? 'Looking up…' : 'Look up'}
                            </Button>
                            {error && (
                                <p className={styles.formError} role="alert">
                                    {error}
                                </p>
                            )}
                        </form>
                    </Panel>

                    {result && (
                        <Panel>
                            <div className={styles.profileHeader}>
                                <div className={styles.profileRing}>{result.gameName.slice(0, 2).toUpperCase()}</div>
                                <div className={styles.profileHeaderText}>
                                    <div className={styles.profileName}>
                                        {result.gameName}
                                        <span className={styles.profileTag}>#{result.tagLine}</span>
                                    </div>
                                    <span className={styles.confirmedBadge}>Account confirmed via Riot API</span>
                                </div>
                            </div>

                            <div className={styles.lockedGrid}>
                                {LOCKED_STATS.map(({ label, icon: Icon }) => (
                                    <div key={label} className={styles.lockedTile}>
                                        <div className={styles.lockedTileHead}>
                                            <Icon />
                                            <LockIcon />
                                        </div>
                                        <div className={styles.lockedValue}>—</div>
                                        <div className={styles.lockedLabel}>{label}</div>
                                    </div>
                                ))}
                            </div>
                            <p className={styles.lockedNote}>
                                Match history and detailed stats unlock automatically once Riot approves full API access
                                for Extree Stats — nothing further to do on your end.
                            </p>
                        </Panel>
                    )}

                    <p className={styles.disclaimer}>{RIOT_DISCLAIMER}</p>
                </>
            )}
        </DashboardShell>
    );
}
