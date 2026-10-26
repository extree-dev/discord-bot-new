import { useEffect, useState } from 'react';
import { Panel } from '../../shared/ui/Panel';
import { getLoginHistory, removeLoginHistoryEntry, type LoginEvent } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

// Называется "Recent Sign-ins", не "Active Sessions": сессии в этом
// проекте полностью stateless (зашифрованная cookie, без серверного
// реестра токенов) — здесь нет понятия "активной сессии", которую можно
// реально прервать. "Remove" ниже стирает только запись в истории входов,
// не отзывает токен устройства — он живёт до истечения Max-Age (7 дней)
// независимо от этой кнопки. Раньше кнопка называлась "Log out" и
// обещала то, чего не делала.
export function ActiveSessions() {
    const [events, setEvents] = useState<LoginEvent[] | null>(null);
    const [pendingId, setPendingId] = useState<string | null>(null);

    useEffect(() => {
        getLoginHistory().then(setEvents);
    }, []);

    async function handleRemove(id: string) {
        setPendingId(id);
        try {
            await removeLoginHistoryEntry(id);
            setEvents(prev => (prev ? prev.filter(e => e.id !== id) : prev));
        } catch {
            alert('Не удалось удалить запись из истории');
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
            subtitle="A log of recent logins to your account. This isn't a list of active sessions — removing an entry only clears it from this history, it doesn't sign that device out."
        >
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
                                    {index === 0 && <span className={styles.badge}>Most recent</span>}
                                </div>
                                <div className={styles.meta}>
                                    {formatLocation(event)} {event.ip && `• IP: ${event.ip}`}
                                </div>
                            </div>
                            <button
                                className={styles.btn}
                                onClick={() => handleRemove(event.id)}
                                disabled={pendingId === event.id}
                            >
                                {pendingId === event.id ? 'Removing…' : 'Remove'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
