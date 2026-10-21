import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { StatusPill } from '../../shared/ui/StatusPill';
import { Select } from '../../shared/ui/Select';
import { TextField } from '../../shared/ui/TextField';
import { TextArea } from '../../shared/ui/TextArea';
import { Button } from '../../shared/ui/Button';
import {
    getAccount,
    getAdminTickets,
    getCannedResponses,
    createCannedResponse,
    deleteCannedResponse,
    ApiError,
    type AccountUser,
    type TicketStatus,
    type TicketSummary,
    type CannedResponse,
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
    { value: 'in_progress', label: 'In progress' },
    { value: 'closed', label: 'Closed' },
];

// Готовые ответы ("macros") — общий пул для всех админов, управляются
// прямо здесь (список тикетов — тот самый экран, где они и нужны), а не
// в отдельных "настройках", которых у этого продукта пока нет.
function CannedResponsesPanel() {
    const [responses, setResponses] = useState<CannedResponse[] | null>(null);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    function load() {
        getCannedResponses()
            .then(result => setResponses(result.responses))
            .catch(() => setResponses([]));
    }

    useEffect(load, []);

    async function onAdd(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            await createCannedResponse(title, body);
            setTitle('');
            setBody('');
            load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    async function onDelete(id: string) {
        await deleteCannedResponse(id);
        load();
    }

    return (
        <Panel title="Canned responses" subtitle="Reusable reply templates, available when replying to a ticket.">
            {error && (
                <p className={styles.cannedError} role="alert">
                    {error}
                </p>
            )}
            {responses && responses.length > 0 && (
                <ul className={styles.cannedList}>
                    {responses.map(r => (
                        <li key={r.id} className={styles.cannedItem}>
                            <div className={styles.cannedItemTitle}>{r.title}</div>
                            <div className={styles.cannedItemBody}>{r.body}</div>
                            <button type="button" className={styles.cannedDelete} onClick={() => onDelete(r.id)}>
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <form className={styles.cannedForm} onSubmit={onAdd}>
                <TextField
                    id="canned-title"
                    label="Title"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                />
                <TextArea id="canned-body" label="Body" required value={body} onChange={e => setBody(e.target.value)} />
                <Button type="submit" variant="ghost" disabled={pending || !title.trim() || !body.trim()}>
                    {pending ? 'Adding…' : 'Add canned response'}
                </Button>
            </form>
        </Panel>
    );
}

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
                    <>
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
                                        <li key={t.number}>
                                            <Link to={`/admin/tickets/${t.number}`} className={styles.row}>
                                                <StatusPill status={t.status} />
                                                <div className={styles.rowMain}>
                                                    <div className={styles.subject}>
                                                        <span className={styles.number}>#{t.number}</span> {t.subject}
                                                    </div>
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

                        <CannedResponsesPanel />
                    </>
                )
            )}
        </DashboardShell>
    );
}
