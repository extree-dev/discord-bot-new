import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { StatusPill } from '../../shared/ui/StatusPill';
import { Select } from '../../shared/ui/Select';
import { TextArea } from '../../shared/ui/TextArea';
import { Button } from '../../shared/ui/Button';
import { TicketThread } from '../../widgets/ticket-thread';
import { CannedResponsesPanel } from '../../widgets/canned-responses';
import {
    getAccount,
    getAdminTicket,
    replyToTicketAsAdmin,
    setTicketStatus,
    verifyUser,
    ApiError,
    type AccountUser,
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
    const [account, setAccount] = useState<AccountUser | null>(null);
    const [checking, setChecking] = useState(true);
    const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
    const [replies, setReplies] = useState<TicketReply[]>([]);
    const [message, setMessage] = useState('');
    const [pending, setPending] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        getAccount().then(u => {
            if (!u) navigate('/login');
            else {
                setAccount(u);
                setChecking(false);
            }
        });
    }, [navigate]);

    useEffect(() => {
        if (checking || !number) return;
        getAdminTicket(number)
            .then(res => {
                setTicket(res.ticket);
                setReplies(res.replies);
            })
            .catch(() => {});
    }, [checking, number]);

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

    if (checking || !ticket)
        return (
            <DashboardShell user={null} title="Loading...">
                Loading...
            </DashboardShell>
        );

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
        <DashboardShell user={{ email: account!.email, isAdmin: account!.isAdmin }} title="" wide>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div>
                        <Link to="/admin/tickets" className={styles.backBtn}>
                            ← Back to all tickets
                        </Link>
                        <h1 className={styles.title}>{ticket.subject}</h1>
                        <div className={styles.meta}>
                            Ticket #{ticket.number} • {ticket.email}
                        </div>
                    </div>
                    <StatusPill status={ticket.status} />
                </div>

                <div className={styles.layout}>
                    <div className={styles.main}>
                        <Panel>
                            <TicketThread messages={threadMessages} />

                            {ticket.status !== 'closed' ? (
                                <form className={styles.replyForm} onSubmit={onReply}>
                                    <TextArea
                                        id="reply"
                                        label="Reply"
                                        placeholder="Type your reply here..."
                                        required
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                    />
                                    <Button type="submit" variant="flat" disabled={pending || !message.trim()}>
                                        {pending ? 'Sending…' : 'Send reply'}
                                    </Button>
                                </form>
                            ) : (
                                <p className={styles.closedNotice}>This ticket is closed.</p>
                            )}
                        </Panel>
                    </div>

                    <aside className={styles.sidebar}>
                        <Panel title="User Profile">
                            <div className={styles.propertyRow}>
                                <span className={styles.propertyLabel}>Email</span>
                                <span className={styles.propertyValue}>{ticket.email}</span>
                            </div>
                            <div className={styles.propertyRow}>
                                <span className={styles.propertyLabel}>Verified</span>
                                <span className={styles.propertyValue}>{ticket.isUserVerified ? 'Yes' : 'No'}</span>
                            </div>
                            <div style={{ marginTop: '16px' }}>
                                <Button
                                    variant="flat"
                                    fullWidth
                                    onClick={handleVerify}
                                    disabled={isVerifying || !ticket.userId}
                                    style={{
                                        backgroundColor: ticket.isUserVerified ? 'var(--surface-2)' : 'var(--accent)',
                                    }}
                                >
                                    {isVerifying
                                        ? 'Updating...'
                                        : ticket.isUserVerified
                                          ? 'Remove Checkmark'
                                          : 'Give Blue Checkmark'}
                                </Button>
                            </div>
                        </Panel>

                        <Panel title="Properties">
                            <div className={styles.propertyRow}>
                                <span className={styles.propertyLabel}>Status</span>
                                <div style={{ width: '140px' }}>
                                    <Select options={STATUS_OPTIONS} value={ticket.status} onChange={onStatusChange} />
                                </div>
                            </div>
                            <div className={styles.propertyRow}>
                                <span className={styles.propertyLabel}>Category</span>
                                <span className={styles.propertyValue} style={{ textTransform: 'capitalize' }}>
                                    {ticket.category}
                                </span>
                            </div>
                            <div className={styles.propertyRow}>
                                <span className={styles.propertyLabel}>Created</span>
                                <span className={styles.propertyValue}>{ticket.time}</span>
                            </div>
                        </Panel>

                        <CannedResponsesPanel />
                    </aside>
                </div>
            </div>
        </DashboardShell>
    );
}
