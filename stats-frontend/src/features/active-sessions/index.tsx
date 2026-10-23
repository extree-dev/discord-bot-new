import { useEffect, useState } from 'react';
import { Panel } from '../../shared/ui/Panel';
import { getLoginHistory, logoutSession, type LoginEvent } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function ActiveSessions() {
    const [events, setEvents] = useState<LoginEvent[] | null>(null);
    const [pendingId, setPendingId] = useState<string | null>(null);

    useEffect(() => {
        getLoginHistory().then(setEvents);
    }, []);

    async function handleLogout(id: string) {
        setPendingId(id);
        try {
            await logoutSession(id);
            setEvents(prev => (prev ? prev.filter(e => e.id !== id) : prev));
        } catch {
            alert('Не удалось завершить сессию');
        } finally {
            setPendingId(null);
        }
    }

    function formatLocation(event: LoginEvent): string {
        if (!event.country) return 'Unknown location';
        return event.city ? `${event.city}, ${event.country}` : event.country;
    }

    return (
        <Panel title="Active Sessions" subtitle="Devices that have recently accessed your account.">
            {events === null && <p className={styles.hint}>Loading…</p>}
            {events?.length === 0 && <p className={styles.hint}>No active sessions.</p>}
            {events && events.length > 0 && (
                <ul className={styles.list}>
                    {events.map((event, index) => (
                        <li key={event.id} className={styles.item}>
                            <div className={styles.icon}>💻</div>
                            <div className={styles.info}>
                                <div className={styles.device}>
                                    {event.device || 'Unknown device'}
                                    {index === 0 && <span className={styles.badge}>Current Session</span>}
                                </div>
                                <div className={styles.meta}>
                                    {formatLocation(event)} {event.ip && `• IP: ${event.ip}`}
                                </div>
                            </div>
                            {index !== 0 && (
                                <button
                                    className={styles.btn}
                                    onClick={() => handleLogout(event.id)}
                                    disabled={pendingId === event.id}
                                >
                                    {pendingId === event.id ? 'Logging out…' : 'Log out'}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
