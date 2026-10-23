import { useMemo, useState } from 'react';
import { formatRelativeTime } from '../../shared/lib/formatRelativeTime';
import { Skeleton } from '../../shared/ui/Skeleton';
import { type TicketStatus, type TicketSummary } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const CATEGORY_LABELS: Record<string, string> = {
    account: 'Account & login',
    bug: 'Bug report',
    billing: 'Billing',
    other: 'Other',
};

const STATUS_FILTERS: Array<{ key: '' | TicketStatus; label: string }> = [
    { key: '', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'closed', label: 'Closed' },
];

interface AdminTicketsListProps {
    tickets: TicketSummary[] | null;
    activeNumber: number | null;
    onSelect: (number: number) => void;
    status: '' | TicketStatus;
    onStatusChange: (status: '' | TicketStatus) => void;
}

export function AdminTicketsList({ tickets, activeNumber, onSelect, status, onStatusChange }: AdminTicketsListProps) {
    const [search, setSearch] = useState('');

    const counts = useMemo(() => {
        if (!tickets) return { total: 0, open: 0, in_progress: 0, closed: 0 };
        return {
            total: tickets.length,
            open: tickets.filter(t => t.status === 'open').length,
            in_progress: tickets.filter(t => t.status === 'in_progress').length,
            closed: tickets.filter(t => t.status === 'closed').length,
        };
    }, [tickets]);

    const visible = useMemo(() => {
        if (!tickets) return null;
        const q = search.trim().toLowerCase();
        if (!q) return tickets;
        return tickets.filter(t => t.subject.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
    }, [tickets, search]);

    function countFor(key: '' | TicketStatus): number {
        if (key === '') return counts.total;
        return counts[key];
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <h1 className={styles.title}>Inbox</h1>
                    {tickets && <span className={styles.badge}>{counts.total}</span>}
                </div>

                <div className={styles.searchWrapper}>
                    <svg
                        className={styles.searchIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="search"
                        className={styles.searchInput}
                        placeholder="Search by subject or email…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <nav className={styles.filters} aria-label="Filter tickets by status">
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f.key || 'all'}
                            type="button"
                            className={`${styles.filterBtn} ${status === f.key ? styles.filterBtnActive : ''}`}
                            onClick={() => onStatusChange(f.key)}
                        >
                            <span>{f.label}</span>
                            <span className={styles.filterCount}>{countFor(f.key)}</span>
                        </button>
                    ))}
                </nav>
            </div>

            <div className={styles.scrollArea}>
                {tickets === null && <TicketListSkeleton />}
                {visible && visible.length === 0 && (
                    <div className={styles.placeholder}>
                        {search.trim() ? 'No tickets match your search.' : 'No tickets in this filter.'}
                    </div>
                )}
                {visible && visible.length > 0 && (
                    <ul className={styles.list}>
                        {visible.map(t => (
                            <li key={t.number}>
                                <button
                                    type="button"
                                    className={`${styles.card} ${activeNumber === t.number ? styles.cardActive : ''}`}
                                    onClick={() => onSelect(t.number)}
                                >
                                    <div className={styles.cardTop}>
                                        <StatusDot status={t.status} />
                                        <span className={styles.number}>#{t.number}</span>
                                        <span className={styles.time}>{formatRelativeTime(t.time)}</span>
                                    </div>
                                    <div className={styles.subject}>{t.subject}</div>
                                    <div className={styles.meta}>
                                        <span className={styles.email}>{t.email}</span>
                                        <span className={styles.category}>
                                            {CATEGORY_LABELS[t.category] ?? t.category}
                                        </span>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function StatusDot({ status }: { status: TicketStatus }) {
    return <span className={`${styles.dot} ${styles[`dot_${status}`]}`} aria-hidden="true" />;
}

// Skeleton для левой колонки — 5 placeholder-карточек, чтобы layout не
// "прыгал" при загрузке (высота карточки ~60px + отступы).
function TicketListSkeleton() {
    return (
        <div className={styles.skeletonList} aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={styles.skeletonCard}>
                    <Skeleton width="40%" height={10} radius={3} />
                    <Skeleton width="90%" height={14} radius={4} />
                    <Skeleton width="60%" height={11} radius={3} />
                </div>
            ))}
        </div>
    );
}
