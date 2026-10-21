import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { TicketThread } from '../../widgets/ticket-thread';
import { Panel } from '../../shared/ui/Panel';
import { StatusPill } from '../../shared/ui/StatusPill';
import { TextArea } from '../../shared/ui/TextArea';
import { Button } from '../../shared/ui/Button';
import {
    getAccount,
    getAdminTicket,
    replyToTicketAsAdmin,
    setTicketStatus,
    ApiError,
    type AccountUser,
    type AdminTicketDetail,
    type TicketReply,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const CATEGORY_LABELS: Record<string, string> = {
    account: 'Account & login',
    bug: 'Bug report',
    billing: 'Billing',
    other: 'Other',
};

export function AdminTicketPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [account, setAccount] = useState<AccountUser | null>(null);
    const [checkingAccount, setCheckingAccount] = useState(true);
    const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
    const [replies, setReplies] = useState<TicketReply[]>([]);
    const [message, setMessage] = useState('');
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
        if (checkingAccount || !id) return;
        let cancelled = false;
        getAdminTicket(id)
            .then(result => {
                if (cancelled) return;
                setTicket(result.ticket);
                setReplies(result.replies);
            })
            .catch(err => {
                if (cancelled) return;
                setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
            });
        return () => {
            cancelled = true;
        };
    }, [checkingAccount, id]);

    async function onReply(e: FormEvent) {
        e.preventDefault();
        if (!id) return;
        setError(null);
        setPending(true);
        try {
            await replyToTicketAsAdmin(id, message);
            setReplies(rs => [...rs, { id: crypto.randomUUID(), author: 'admin', message, time: 'Just now' }]);
            setMessage('');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    async function onToggleStatus() {
        if (!id || !ticket) return;
        const next = ticket.status === 'open' ? 'closed' : 'open';
        setStatusPending(true);
        setError(null);
        try {
            await setTicketStatus(id, next);
            setTicket(t => t && { ...t, status: next });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setStatusPending(false);
        }
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
            subtitle={ticket ? `Ticket ${ticket.id}` : undefined}
            headerExtra={ticket && <StatusPill status={ticket.status} />}
            error={error}
            wide
        >
            {ticket && (
                <div className={styles.layout}>
                    <Panel>
                        <TicketThread messages={threadMessages} />
                        <form className={styles.form} onSubmit={onReply}>
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
                            <Button
                                type="button"
                                variant="ghost"
                                fullWidth
                                onClick={onToggleStatus}
                                disabled={statusPending}
                            >
                                {statusPending
                                    ? 'Updating…'
                                    : ticket.status === 'open'
                                      ? 'Close ticket'
                                      : 'Reopen ticket'}
                            </Button>
                        </div>
                    </Panel>
                </div>
            )}
        </DashboardShell>
    );
}
