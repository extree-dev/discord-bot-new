import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../../widgets/auth-card';
import { Select } from '../../shared/ui/Select';
import {
    getAccount,
    getAdminTickets,
    ApiError,
    type TicketStatus,
    type TicketSummary,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const STATUS_OPTIONS = [
    { value: '', label: 'All tickets' },
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
];

// Та же "белый список по email" админка, что на бэкенде (SUPPORT_ADMIN_EMAILS,
// см. server.js) — не пускаем никого без сессии, а дальше бэкенд сам решает,
// в списке ли аккаунт (403 → сообщение ниже, не редирект: это не "неправильный
// вход", а "вход правильный, но не ты").
export function AdminTicketsPage() {
    const navigate = useNavigate();
    const [checkingAccount, setCheckingAccount] = useState(true);
    const [status, setStatus] = useState<TicketStatus | ''>('');
    const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getAccount().then(user => {
            if (cancelled) return;
            if (!user) {
                navigate('/login');
                return;
            }
            setCheckingAccount(false);
        });
        return () => {
            cancelled = true;
        };
    }, [navigate]);

    useEffect(() => {
        if (checkingAccount) return;
        let cancelled = false;
        setTickets(null);
        setError(null);
        getAdminTickets(status || undefined)
            .then(result => {
                if (!cancelled) setTickets(result.tickets);
            })
            .catch(err => {
                if (cancelled) return;
                setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
            });
        return () => {
            cancelled = true;
        };
    }, [checkingAccount, status]);

    if (checkingAccount) {
        return <AuthCard title="Support tickets">Loading…</AuthCard>;
    }

    return (
        <AuthCard title="Support tickets" error={error}>
            {!error && (
                <>
                    <div className={styles.filterRow}>
                        <Select
                            id="status-filter"
                            label="Status"
                            options={STATUS_OPTIONS}
                            value={status}
                            onChange={e => setStatus(e.target.value as TicketStatus | '')}
                        />
                    </div>
                    {tickets === null && <p className={styles.hint}>Loading…</p>}
                    {tickets?.length === 0 && <p className={styles.hint}>No tickets here.</p>}
                    {tickets && tickets.length > 0 && (
                        <ul className={styles.list}>
                            {tickets.map(t => (
                                <li key={t.id}>
                                    <Link to={`/admin/tickets/${t.id}`} className={styles.item}>
                                        <div className={styles.itemTop}>
                                            <span className={styles.subject}>{t.subject}</span>
                                            <span
                                                className={`${styles.badge} ${t.status === 'open' ? styles.badgeOpen : styles.badgeClosed}`}
                                            >
                                                {t.status}
                                            </span>
                                        </div>
                                        <div className={styles.meta}>
                                            {t.email} · {t.time}
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </AuthCard>
    );
}
