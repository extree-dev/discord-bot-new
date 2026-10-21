import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { AuthCard } from '../../widgets/auth-card';
import { TextArea } from '../../shared/ui/TextArea';
import { Button } from '../../shared/ui/Button';
import {
    getTicketByToken,
    replyToTicket,
    ApiError,
    type TicketDetail,
    type TicketReply,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

// Публичная страница тикета по секретной ссылке из письма (view_token,
// см. supportTickets.js) — без входа, так же как подача заявки изначально:
// вход не нужен ни для вопроса, ни для ответа на него.
export function TicketPage() {
    const { token } = useParams<{ token: string }>();
    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [replies, setReplies] = useState<TicketReply[]>([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        getTicketByToken(token)
            .then(result => {
                if (cancelled) return;
                setTicket(result.ticket);
                setReplies(result.replies);
            })
            .catch(err => {
                if (cancelled) return;
                setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    async function onReply(e: FormEvent) {
        e.preventDefault();
        if (!token) return;
        setError(null);
        setNotice(null);
        setPending(true);
        try {
            await replyToTicket(token, message);
            setReplies(rs => [...rs, { id: crypto.randomUUID(), author: 'user', message, time: 'just now' }]);
            setMessage('');
            setNotice('Sent — we usually reply within 24 hours.');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    if (loading) {
        return <AuthCard title="Your ticket">Loading…</AuthCard>;
    }

    return (
        <AuthCard title={ticket?.subject ?? 'Your ticket'} error={error}>
            {ticket && (
                <>
                    <div className={styles.meta}>
                        <span
                            className={`${styles.badge} ${ticket.status === 'open' ? styles.badgeOpen : styles.badgeClosed}`}
                        >
                            {ticket.status}
                        </span>
                        <span>{ticket.time}</span>
                    </div>

                    <div className={styles.thread}>
                        <div className={styles.bubble}>
                            <span className={styles.bubbleAuthor}>You</span>
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
                                <span className={styles.bubbleAuthor}>{r.author === 'admin' ? 'Support' : 'You'}</span>
                                {r.message}
                                <span className={styles.bubbleTime}>{r.time}</span>
                            </div>
                        ))}
                    </div>

                    {notice && <p className={styles.closedNotice}>{notice}</p>}

                    {ticket.status === 'open' ? (
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
                    ) : (
                        <p className={styles.closedNotice}>This ticket is closed.</p>
                    )}
                </>
            )}
        </AuthCard>
    );
}
