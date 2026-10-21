import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { TicketThread } from '../../widgets/ticket-thread';
import { Panel } from '../../shared/ui/Panel';
import { StatusPill } from '../../shared/ui/StatusPill';
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
// вход не нужен ни для вопроса, ни для ответа на него. DashboardShell тут
// без user (нет сессии) — просто бренд в шапке, без навигации.
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
            setReplies(rs => [...rs, { id: crypto.randomUUID(), author: 'user', message, time: 'Just now' }]);
            setMessage('');
            setNotice('Sent — we usually reply within 24 hours.');
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    if (loading) {
        return (
            <DashboardShell user={null} title="Your ticket">
                <Panel>Loading…</Panel>
            </DashboardShell>
        );
    }

    const threadMessages = ticket
        ? [
              { id: 'original', isSupport: false, authorLabel: 'You', message: ticket.message, time: ticket.time },
              ...replies.map(r => ({
                  id: r.id,
                  isSupport: r.author === 'admin',
                  authorLabel: r.author === 'admin' ? 'Support' : 'You',
                  message: r.message,
                  time: r.time,
              })),
          ]
        : [];

    return (
        <DashboardShell
            user={null}
            title={ticket?.subject ?? 'Your ticket'}
            subtitle={ticket ? `Ticket ${ticket.id}` : undefined}
            headerExtra={ticket && <StatusPill status={ticket.status} />}
            error={error}
        >
            {ticket && (
                <Panel>
                    <TicketThread messages={threadMessages} />

                    {notice && <p className={styles.notice}>{notice}</p>}

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
                            <div className={styles.formActions}>
                                <Button type="submit" variant="flat" disabled={pending || !message.trim()}>
                                    {pending ? 'Sending…' : 'Send reply'}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <p className={styles.closedNotice}>This ticket is closed.</p>
                    )}
                </Panel>
            )}
        </DashboardShell>
    );
}
