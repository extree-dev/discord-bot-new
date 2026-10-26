import { Avatar } from '../../shared/ui/Avatar';
import { formatRelativeTime } from '../../shared/lib/formatRelativeTime';
import { Skeleton } from '../../shared/ui/Skeleton';
import styles from './index.module.scss';

interface ThreadMessage {
    id: string;
    isSupport: boolean;
    authorLabel: string;
    message: string;
    time: string;
}

interface TicketThreadProps {
    messages: ThreadMessage[];
}

// Comment-style thread (Linear / GitHub Issues): без пузырей, только
// Avatar + author + relative time + свободный текст. Используется и в
// админке, и в публичной странице тикета.
export function TicketThread({ messages }: TicketThreadProps) {
    if (messages.length === 0) {
        return <ThreadSkeleton />;
    }
    return (
        <div className={styles.thread}>
            {messages.map(m => (
                <article key={m.id} className={`${styles.comment} ${m.isSupport ? styles.commentSupport : ''}`}>
                    <Avatar label={m.authorLabel} isSupport={m.isSupport} />
                    <div className={styles.body}>
                        <header className={styles.head}>
                            <span className={styles.author}>{m.authorLabel}</span>
                            <span className={styles.time}>{formatRelativeTime(m.time)}</span>
                        </header>
                        <div className={styles.message}>{m.message}</div>
                    </div>
                </article>
            ))}
        </div>
    );
}

function ThreadSkeleton() {
    return (
        <div className={styles.thread} aria-hidden="true">
            {[0, 1, 2].map(i => (
                <article key={i} className={styles.comment}>
                    <Skeleton width={32} height={32} radius="50%" />
                    <div className={styles.body}>
                        <div className={styles.skeletonHead}>
                            <Skeleton width={80} height={12} radius={3} />
                            <Skeleton width={48} height={10} radius={3} />
                        </div>
                        <Skeleton width="100%" height={14} radius={4} />
                        <div style={{ height: 8 }} />
                        <Skeleton width="80%" height={14} radius={4} />
                    </div>
                </article>
            ))}
        </div>
    );
}
