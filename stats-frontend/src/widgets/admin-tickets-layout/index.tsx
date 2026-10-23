import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { DashboardShell } from '../dashboard-shell';
import { AdminTicketsList } from '../admin-tickets-list';
import {
    getAccount,
    getAdminTickets,
    ApiError,
    type AccountUser,
    type TicketStatus,
    type TicketSummary,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

// SRP: этот компонент — только композиция (shell + две колонки + fetch
// списка + навигация по выбору). Сама левая колонка — AdminTicketsList.
// Сама правая — Outlet (AdminTicketPage / AdminTicketsPlaceholder).
//
// Про роутер: useParams/useNavigate, но не про API деталей тикета.
// Про API: только list (getAdminTickets) + account. Детали тикета тянет
// AdminTicketPage сам, в своей зоне ответственности.
export function AdminTicketsLayout() {
    const navigate = useNavigate();
    const params = useParams<{ number?: string }>();
    const activeNumber = params.number ? Number(params.number) : null;

    const [account, setAccount] = useState<AccountUser | null>(null);
    const [checkingAccount, setCheckingAccount] = useState(true);
    const [status, setStatus] = useState<'' | TicketStatus>('');
    const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getAccount().then(({ user, banned }) => {
            if (cancelled) return;
            if (banned || !user) {
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

    const handleSelect = useCallback(
        (number: number) => {
            navigate(`/admin/tickets/${number}`);
        },
        [navigate]
    );

    const dashUser = account ? { email: account.email, isAdmin: account.isAdmin } : null;

    return (
        <DashboardShell user={dashUser} title="" wide>
            <div className={styles.layout}>
                <aside className={styles.list}>
                    {checkingAccount ? (
                        <div className={styles.center}>Loading…</div>
                    ) : error ? (
                        <div className={styles.center}>
                            <p className={styles.error}>{error}</p>
                        </div>
                    ) : (
                        <AdminTicketsList
                            tickets={tickets}
                            activeNumber={activeNumber}
                            onSelect={handleSelect}
                            status={status}
                            onStatusChange={setStatus}
                        />
                    )}
                </aside>
                <main className={styles.detail}>
                    <Outlet />
                </main>
            </div>
        </DashboardShell>
    );
}
