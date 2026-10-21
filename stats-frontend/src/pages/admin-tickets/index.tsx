import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { StatusPill } from '../../shared/ui/StatusPill';
import { Select } from '../../shared/ui/Select';
import {
    getAccount,
    getAdminTickets,
    ApiError,
    type AccountUser,
    type TicketStatus,
    type TicketSummary,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const CATEGORY_LABELS: Record<string, string> = {
    account: 'Account & login',
    bug: 'Bug report',
    billing: 'Billing',
    other: 'Other',
};

const STATUS_OPTIONS = [
    { value: '', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
];

// Та же "белый список по email" админка, что на бэкенде (SUPPORT_ADMIN_EMAILS,
// см. server.js) — не пускаем никого без сессии, а дальше бэкенд сам решает,
// в списке ли аккаунт (403 → сообщение, не редирект: это не "неправильный
// вход", а "вход правильный, но не ты").
export function AdminTicketsPage() {
    const navigate = useNavigate();
    const [account, setAccount] = useState<AccountUser | null>(null);
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
            setAccount(user);
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

    const dashUser = account ? { email: account.email, isAdmin: account.isAdmin } : null;

    return (
        <DashboardShell
            user={dashUser}
            active="tickets"
            title="Support tickets"
            subtitle={tickets ? `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}` : undefined}
            error={error}
            wide
        >
            {checkingAccount ? (
                <Panel>Loading…</Panel>
            ) : (
                !error && (
                    <Panel noBodyPadding>
                        <div className={styles.filterBar}>
                            <Select
                                id="status-filter"
                                label="Status"
                                options={STATUS_OPTIONS}
                                value={status}
                                onChange={e => setStatus(e.target.value as TicketStatus | '')}
                            />
                        </div>
                        {tickets === null && <p className={styles.empty}>Loading…</p>}
                        {tickets?.length === 0 && <p className={styles.empty}>No tickets here.</p>}
                        {tickets && tickets.length > 0 && (
                            <ul className={styles.list}>
                                {tickets.map(t => (
                                    <li key={t.id}>
                                        <Link to={`/admin/tickets/${t.id}`} className={styles.row}>
                                            <StatusPill status={t.status} />
                                            <div className={styles.rowMain}>
                                                <div className={styles.subject}>{t.subject}</div>
                                                <div className={styles.meta}>{t.email}</div>
                                            </div>
                                            <span className={styles.category}>
                                                {CATEGORY_LABELS[t.category] ?? t.category}
                                            </span>
                                            <span className={styles.time}>{t.time}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                )
            )}
        </DashboardShell>
    );
}
