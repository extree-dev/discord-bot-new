import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthCard } from '../../widgets/auth-card';
import { TextArea } from '../../shared/ui/TextArea';
import { Button } from '../../shared/ui/Button';
import {
    getAccount,
    getAdminTicket,
    replyToTicketAsAdmin,
    setTicketStatus,
    ApiError,
    type AdminTicketDetail,
    type TicketReply,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function AdminTicketPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
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
            setReplies(rs => [...rs, { id: crypto.randomUUID(), author: 'admin', message, time: 'just now' }]);
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

    if (checkingAccount || (!ticket && !error)) {
        return <AuthCard title="Ticket">Loading…</AuthCard>;
    }

    return (
        <AuthCard title={ticket?.subject ?? 'Ticket'} error={error}>
            <Link to="/admin/tickets" className={styles.back}>
                ← All tickets
            </Link>
            {ticket && (
                <>
                    <div className={styles.meta}>
                        <span
                            className={`${styles.badge} ${ticket.status === 'open' ? styles.badgeOpen : styles.badgeClosed}`}
                        >
                            {ticket.status}
                        </span>
                        <span>{ticket.email}</span>
                        <span>{ticket.category}</span>
                        <span>{ticket.time}</span>
                    </div>

                    <div className={styles.thread}>
                        <div className={styles.bubble}>
                            <span className={styles.bubbleAuthor}>{ticket.email}</span>
                            {ticket.message}
                            <span className={styles.bubbleTime}>{ticket.time}</span>
                        </div>
                        {replies.map(r => (
                            <div
                                key={r.id}
                                className={
                                    r.author === 'admin' ? `${styles.bubble} ${styles.bubbleAdmin}` : styles.bubble
                                }
                            >
                                <span className={styles.bubbleAuthor}>
                                    {r.author === 'admin' ? 'Support' : ticket.email}
                                </span>
                                {r.message}
                                <span className={styles.bubbleTime}>{r.time}</span>
                            </div>
                        ))}
                    </div>

                    <form className={styles.form} onSubmit={onReply}>
                        <TextArea
                            id="reply"
                            label="Reply"
                            required
                            maxLength={5000}
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                        <Button type="submit" variant="flat" fullWidth disabled={pending || !message.trim()}>
                            {pending ? 'Sending…' : 'Send reply'}
                        </Button>
                    </form>

                    <div className={styles.statusRow}>
                        <Button
                            type="button"
                            variant="ghost"
                            fullWidth
                            onClick={onToggleStatus}
                            disabled={statusPending}
                        >
                            {statusPending ? 'Updating…' : ticket.status === 'open' ? 'Close ticket' : 'Reopen ticket'}
                        </Button>
                    </div>
                </>
            )}
        </AuthCard>
    );
}
