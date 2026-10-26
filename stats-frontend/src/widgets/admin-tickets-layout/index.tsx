import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { DashboardShell } from '../dashboard-shell';
import { AdminTicketsList } from '../admin-tickets-list';
import { useIsMobile } from '../../shared/lib/useMediaQuery';
import {
    getAccount,
    getAdminTickets,
    ApiError,
    type AccountUser,
    type TicketStatus,
    type TicketSummary,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

// SRP: только композиция (shell + 2 колонки + fetch списка + навигация).
// Mobile: если URL = /admin/tickets/:number — рендерим ТОЛЬКО правую
// колонку (детальную); если URL = /admin/tickets — только левую.
// Так на мобильном в DOM нет "скрытой" колонки — меньше работы и не
// грузятся лишние fetch-и из невидимого компонента.
export function AdminTicketsLayout() {
    const navigate = useNavigate();
    const params = useParams<{ number?: string }>();
    const isMobile = useIsMobile();
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

    // На мобильном показываем только одну колонку — как список тикетов
    // в нативном почтовом клиенте (открыл тикет — ушёл в детальную,
    // нажал "назад" — вернулся в список).
    const showList = !isMobile || activeNumber === null;
    const showDetail = !isMobile || activeNumber !== null;

    return (
        <DashboardShell user={dashUser} title="" wide>
            <div className={`${styles.layout} ${isMobile ? styles.layoutMobile : ''}`}>
                {showList && (
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
                )}
                {showDetail && (
                    <main className={styles.detail}>
                        <Outlet />
                    </main>
                )}
            </div>
        </DashboardShell>
    );
}
