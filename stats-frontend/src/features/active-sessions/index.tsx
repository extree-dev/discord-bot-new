import { useEffect, useState } from 'react';
import { Panel } from '../../shared/ui/Panel';
import { getLoginHistory, revokeSession, type LoginEvent } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

// "Sign out" здесь реально отзывает сессию на сервере (см. revokeSession в
// shared/api/statsAuth) — сессии теперь не stateless-cookie, а запись в
// серверном реестре (stats_sessions), которую можно отозвать. Записи из
// истории старше этой функции (session_id пуст на бэкенде) по-прежнему
// просто пропадают из списка — отзывать у них нечего, но это не ошибка.
export function ActiveSessions() {
    const [events, setEvents] = useState<LoginEvent[] | null>(null);
    const [pendingId, setPendingId] = useState<string | null>(null);

    useEffect(() => {
        getLoginHistory().then(setEvents);
    }, []);

    async function handleSignOut(id: string) {
        setPendingId(id);
        try {
            await revokeSession(id);
            setEvents(prev => (prev ? prev.filter(e => e.id !== id) : prev));
        } catch {
            alert('Не удалось выйти из этой сессии');
        } finally {
            setPendingId(null);
        }
    }

    function formatLocation(event: LoginEvent): string {
        if (!event.country) return 'Unknown location';
        return event.city ? `${event.city}, ${event.country}` : event.country;
    }

    return (
        <Panel
            title="Recent Sign-ins"
            subtitle="Devices and locations that have recently signed in to your account. Sign out a device to immediately revoke its access."
        >
            {events === null && <p className={styles.hint}>Loading…</p>}
            {events?.length === 0 && <p className={styles.hint}>No recent sign-ins.</p>}
            {events && events.length > 0 && (
                <ul className={styles.list}>
                    {events.map((event, index) => (
                        <li key={event.id} className={styles.item}>
                            <div className={styles.icon}>💻</div>
                            <div className={styles.info}>
                                <div className={styles.device}>
                                    {event.device || 'Unknown device'}
                                    {index === 0 && <span className={styles.badge}>Most recent</span>}
                                </div>
                                <div className={styles.meta}>
                                    {formatLocation(event)} {event.ip && `• IP: ${event.ip}`}
                                </div>
                            </div>
                            <button
                                className={styles.btn}
                                onClick={() => handleSignOut(event.id)}
                                disabled={pendingId === event.id}
                            >
                                {pendingId === event.id ? 'Signing out…' : 'Sign out'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
