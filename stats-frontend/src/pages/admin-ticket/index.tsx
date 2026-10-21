import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { TicketThread } from '../../widgets/ticket-thread';
import { Panel } from '../../shared/ui/Panel';
import { StatusPill } from '../../shared/ui/StatusPill';
import { Select } from '../../shared/ui/Select';
import { TextArea } from '../../shared/ui/TextArea';
import { Button } from '../../shared/ui/Button';
import {
    getAccount,
    getAdminTicket,
    replyToTicketAsAdmin,
    setTicketStatus,
    getCannedResponses,
    ApiError,
    type AccountUser,
    type AdminTicketDetail,
    type TicketReply,
    type TicketStatus,
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
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'closed', label: 'Closed' },
];

export function AdminTicketPage() {
    const { number } = useParams<{ number: string }>();
    const navigate = useNavigate();
    const [account, setAccount] = useState<AccountUser | null>(null);
    const [checkingAccount, setCheckingAccount] = useState(true);
    const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
    const [replies, setReplies] = useState<TicketReply[]>([]);
    const [message, setMessage] = useState('');
    const [canned, setCanned] = useState<CannedResponse[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [statusPending, setStatusPending] = useState(false);

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
        if (checkingAccount || !number) return;
        let cancelled = false;
        getAdminTicket(number)
            .then(result => {
                if (cancelled) return;
                setTicket(result.ticket);
                setReplies(result.replies);
            })
            .catch(err => {
                if (cancelled) return;
                setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
            });
        getCannedResponses()
            .then(result => {
                if (!cancelled) setCanned(result.responses);
            })
            .catch(() => {
                /* не критично — просто не покажем пикер шаблонов */
            });
        return () => {
            cancelled = true;
        };
    }, [checkingAccount, number]);

    async function onReply(e: FormEvent) {
        e.preventDefault();
        if (!number) return;
        setError(null);
        setPending(true);
        try {
            await replyToTicketAsAdmin(number, message);
            setReplies(rs => [...rs, { id: crypto.randomUUID(), author: 'admin', message, time: 'Just now' }]);
            setMessage('');
            // Первый ответ сдвигает статус на бэкенде в in_progress — отражаем
            // это и тут, чтобы пилюля в заголовке не врала до перезагрузки.
            setTicket(t => (t && t.status === 'open' ? { ...t, status: 'in_progress' } : t));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    async function onStatusChange(next: TicketStatus) {
        if (!number || !ticket) return;
        setStatusPending(true);
        setError(null);
        try {
            await setTicketStatus(number, next);
            setTicket(t => t && { ...t, status: next });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setStatusPending(false);
        }
    }

    function onInsertCanned(id: string) {
        const response = canned.find(c => c.id === id);
        if (response) setMessage(response.body);
    }

    const dashUser = account ? { email: account.email, isAdmin: account.isAdmin } : null;

    if (checkingAccount || (!ticket && !error)) {
        return (
            <DashboardShell user={dashUser} active="tickets" title="Loading…">
                <Panel>Loading…</Panel>
            </DashboardShell>
        );
    }

    const threadMessages = ticket
        ? [
              {
                  id: 'original',
                  isSupport: false,
                  authorLabel: ticket.email,
                  message: ticket.message,
                  time: ticket.time,
              },
              ...replies.map(r => ({
                  id: r.id,
                  isSupport: r.author === 'admin',
                  authorLabel: r.author === 'admin' ? 'Support' : ticket.email,
                  message: r.message,
                  time: r.time,
              })),
          ]
        : [];

    return (
        <DashboardShell
            user={dashUser}
            active="tickets"
            breadcrumb={{ to: '/admin/tickets', label: 'All tickets' }}
            title={ticket?.subject ?? 'Ticket'}
            subtitle={ticket ? `#${ticket.number}` : undefined}
            headerExtra={ticket && <StatusPill status={ticket.status} />}
            error={error}
            wide
        >
            {ticket && (
                <div className={styles.layout}>
                    <Panel>
                        <TicketThread messages={threadMessages} />
                        <form className={styles.form} onSubmit={onReply}>
                            {canned.length > 0 && (
                                <Select
                                    id="canned-response"
                                    label="Insert canned response"
                                    value=""
                                    options={[
                                        { value: '', label: 'Choose a template…' },
                                        ...canned.map(c => ({ value: c.id, label: c.title })),
                                    ]}
                                    onChange={e => {
                                        if (e.target.value) onInsertCanned(e.target.value);
                                    }}
                                />
                            )}
                            <TextArea
                                id="reply"
                                label="Reply"
                                required
                                maxLength={5000}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                            <div className={styles.formActions}>
                                <Button type="submit" variant="flat" disabled={pending || !message.trim()}>
                                    {pending ? 'Sending…' : 'Send reply'}
                                </Button>
                            </div>
                        </form>
                    </Panel>

                    <Panel title="Details">
                        <div className={styles.metaList}>
                            <div className={styles.metaRow}>
                                <span className={styles.metaLabel}>Requester</span>
                                <span className={styles.metaValue}>{ticket.email}</span>
                            </div>
                            <div className={styles.metaRow}>
                                <span className={styles.metaLabel}>Category</span>
                                <span className={styles.metaValue}>
                                    {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                                </span>
                            </div>
                            <div className={styles.metaRow}>
                                <span className={styles.metaLabel}>Opened</span>
                                <span className={styles.metaValue}>{ticket.time}</span>
                            </div>
                            <Select
                                id="ticket-status"
                                label="Status"
                                options={STATUS_OPTIONS}
                                value={ticket.status}
                                disabled={statusPending}
                                onChange={e => onStatusChange(e.target.value as TicketStatus)}
                            />
                        </div>
                    </Panel>
                </div>
            )}
        </DashboardShell>
    );
}
