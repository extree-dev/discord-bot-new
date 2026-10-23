import { Avatar } from '../../shared/ui/Avatar';
import { formatRelativeTime } from '../../shared/lib/formatRelativeTime';
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
// Avatar + author + relative time + свободный текст. Меньше визуального
// шума, легче читается длинная переписка. Используется и в админке,
// и в публичной странице тикета.
export function TicketThread({ messages }: TicketThreadProps) {
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
