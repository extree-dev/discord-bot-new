import { useEffect, useState } from 'react';
import { Panel } from '../../shared/ui/Panel';
import { getLoginHistory, type LoginEvent } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function ActiveSessions() {
    const [events, setEvents] = useState<LoginEvent[] | null>(null);

    useEffect(() => {
        getLoginHistory().then(setEvents);
    }, []);

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
                                    {event.ip === '0:0:0:0:0:0:0:1' || event.ip === '127.0.0.1'
                                        ? 'Localhost'
                                        : 'Unknown Device'}
                                    {index === 0 && <span className={styles.badge}>Current Session</span>}
                                </div>
                                <div className={styles.meta}>
                                    {formatLocation(event)} {event.ip && `• IP: ${event.ip}`}
                                </div>
                            </div>
                            {index !== 0 && <button className={styles.btn}>Log out</button>}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
