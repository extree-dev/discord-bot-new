import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StatusPill } from '../../shared/ui/StatusPill';
import { TextArea } from '../../shared/ui/TextArea';
import { Button } from '../../shared/ui/Button';
import { IconButtonGroup } from '../../shared/ui/IconButtonGroup';
import { EmptyState } from '../../shared/ui/EmptyState';
import { TicketThread } from '../../widgets/ticket-thread';
import { CannedTemplatePicker } from '../../widgets/canned-responses';
import { formatRelativeTime } from '../../shared/lib/formatRelativeTime';
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
] as const;

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

    async function onStatusChange(newStatus: TicketStatus) {
        if (!number) return;
        try {
            await setTicketStatus(number, newStatus);
            setTicket(t => (t ? { ...t, status: newStatus } : null));
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

    const statusIndex = STATUS_OPTIONS.findIndex(o => o.value === ticket.status);

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
                        <span className={styles.sep}>·</span>
                        <span className={styles.category}>{ticket.category}</span>
                        <span className={styles.sep}>·</span>
                        <span className={styles.time}>opened {formatRelativeTime(ticket.time)}</span>
                    </div>
                </div>
                <div className={styles.headerActions}>
                    <IconButtonGroup
                        aria-label="Ticket actions"
                        items={[
                            {
                                key: 'open',
                                icon: <span className={styles.statusIcon}>○</span>,
                                label: 'Mark as Open',
                                onClick: () => onStatusChange('open'),
                                active: statusIndex === 0,
                                disabled: ticket.status === 'open',
                            },
                            {
                                key: 'in_progress',
                                icon: <span className={styles.statusIcon}>◐</span>,
                                label: 'Mark as In progress',
                                onClick: () => onStatusChange('in_progress'),
                                active: statusIndex === 1,
                                disabled: ticket.status === 'in_progress',
                            },
                            {
                                key: 'closed',
                                icon: <span className={styles.statusIcon}>●</span>,
                                label: 'Close ticket',
                                onClick: () => onStatusChange('closed'),
                                active: statusIndex === 2,
                                disabled: ticket.status === 'closed',
                            },
                        ]}
                    />
                    <IconButtonGroup
                        aria-label="User actions"
                        items={[
                            {
                                key: 'verify',
                                icon: <span className={styles.statusIcon}>{ticket.isUserVerified ? '✓' : '☐'}</span>,
                                label: ticket.isUserVerified ? 'Remove checkmark' : 'Give checkmark',
                                onClick: handleVerify,
                                variant: ticket.isUserVerified ? 'default' : 'accent',
                                active: ticket.isUserVerified,
                                disabled: isVerifying || !ticket.userId,
                            },
                        ]}
                    />
                </div>
            </header>

            <div className={styles.body}>
                <section className={styles.thread}>
                    <TicketThread messages={threadMessages} />
                </section>

                {ticket.status !== 'closed' ? (
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
                ) : (
                    <EmptyState
                        title="This ticket is closed"
                        description="Reopen it to send a new reply."
                        action={
                            <Button variant="ghost" size="sm" onClick={() => onStatusChange('open')}>
                                Reopen ticket
                            </Button>
                        }
                    />
                )}
            </div>
        </div>
    );
}
