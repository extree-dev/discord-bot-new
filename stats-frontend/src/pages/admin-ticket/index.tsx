import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Panel } from '../../shared/ui/Panel';
import { StatusPill } from '../../shared/ui/StatusPill';
import { Select } from '../../shared/ui/Select';
import { TextArea } from '../../shared/ui/TextArea';
import { Button } from '../../shared/ui/Button';
import { TicketThread } from '../../widgets/ticket-thread';
import { CannedTemplatePicker } from '../../widgets/canned-responses';
import {
    getAdminTicket,
    replyToTicketAsAdmin,
    setTicketStatus,
    verifyUser,
    type AdminTicketDetail,
    type TicketReply,
    type TicketStatus,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const STATUS_OPTIONS = [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'closed', label: 'Closed' },
];

export function AdminTicketPage() {
    const { number } = useParams<{ number: string }>();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
    const [replies, setReplies] = useState<TicketReply[]>([]);
    const [message, setMessage] = useState('');
    const [pending, setPending] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!number) return;
        let cancelled = false;
        setLoadError(null);
        getAdminTicket(number)
            .then(res => {
                if (cancelled) return;
                setTicket(res.ticket);
                setReplies(res.replies);
            })
            .catch(() => {
                if (!cancelled) setLoadError('Failed to load ticket.');
            });
        return () => {
            cancelled = true;
        };
    }, [number]);

    async function onReply(e: FormEvent) {
        e.preventDefault();
        if (!number || !message.trim()) return;
        setPending(true);
        try {
            await replyToTicketAsAdmin(number, message);
            setMessage('');
            const res = await getAdminTicket(number);
            setTicket(res.ticket);
            setReplies(res.replies);
        } catch {
            alert('Failed to send reply');
        } finally {
            setPending(false);
        }
    }

    async function onStatusChange(newStatus: string) {
        if (!number) return;
        try {
            await setTicketStatus(number, newStatus as TicketStatus);
            setTicket(t => (t ? { ...t, status: newStatus as TicketStatus } : null));
        } catch {
            alert('Failed to update status');
        }
    }

    async function handleVerify() {
        if (!ticket || !ticket.userId) return;
        setIsVerifying(true);
        try {
            const newStatus = !ticket.isUserVerified;
            await verifyUser(ticket.userId, newStatus);
            setTicket(t => (t ? { ...t, isUserVerified: newStatus } : null));
        } catch {
            alert('Failed to update verification status');
        } finally {
            setIsVerifying(false);
        }
    }

    if (loadError) {
        return (
            <div className={styles.center}>
                <p className={styles.errorText}>{loadError}</p>
            </div>
        );
    }

    if (!ticket) {
        return <div className={styles.center}>Loading…</div>;
    }

    const threadMessages = [
        { id: 'original', isSupport: false, authorLabel: 'User', message: ticket.message, time: ticket.time },
        ...replies.map(r => ({
            id: r.id,
            isSupport: r.author === 'admin',
            authorLabel: r.author === 'admin' ? 'Support (You)' : 'User',
            message: r.message,
            time: r.time,
        })),
    ];

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => navigate('/admin/tickets')}
                    aria-label="Back to tickets"
                >
                    ←
                </button>
                <div className={styles.headerMain}>
                    <div className={styles.headerTop}>
                        <span className={styles.number}>#{ticket.number}</span>
                        <StatusPill status={ticket.status} />
                    </div>
                    <h1 className={styles.title}>{ticket.subject}</h1>
                    <div className={styles.meta}>
                        <span className={styles.email}>{ticket.email}</span>
                        <span className={styles.dotDivider} aria-hidden="true">
                            ·
                        </span>
                        <span className={styles.category}>{ticket.category}</span>
                        <span className={styles.dotDivider} aria-hidden="true">
                            ·
                        </span>
                        <span className={styles.time}>{ticket.time}</span>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.statusSelect}>
                        <Select options={STATUS_OPTIONS} value={ticket.status} onChange={onStatusChange} />
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleVerify} disabled={isVerifying || !ticket.userId}>
                        {isVerifying ? 'Updating…' : ticket.isUserVerified ? 'Remove checkmark' : 'Give checkmark'}
                    </Button>
                </div>
            </header>

            <div className={styles.body}>
                <Panel noBodyPadding>
                    <div className={styles.threadWrap}>
                        <TicketThread messages={threadMessages} />
                    </div>
                </Panel>

                {ticket.status !== 'closed' ? (
                    <Panel>
                        <form className={styles.replyForm} onSubmit={onReply}>
                            <TextArea
                                id="reply"
                                label="Reply"
                                placeholder="Type your reply here…"
                                required
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                            <div className={styles.replyActions}>
                                <CannedTemplatePicker
                                    onPick={body => setMessage(prev => (prev ? `${prev}\n\n${body}` : body))}
                                    disabled={pending}
                                />
                                <Button type="submit" variant="flat" disabled={pending || !message.trim()}>
                                    {pending ? 'Sending…' : 'Send reply'}
                                </Button>
                            </div>
                        </form>
                    </Panel>
                ) : (
                    <Panel>
                        <div className={styles.closedRow}>
                            <div>
                                <h3 className={styles.closedTitle}>This ticket is closed</h3>
                                <p className={styles.closedLead}>Reopen it to send a new reply.</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => onStatusChange('open')}>
                                Reopen ticket
                            </Button>
                        </div>
                    </Panel>
                )}
            </div>
        </div>
    );
}
