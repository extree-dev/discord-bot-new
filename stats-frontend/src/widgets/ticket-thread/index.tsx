import { Avatar } from '../../shared/ui/Avatar';
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

// Общий компонент треда для /admin/tickets/:id и /support/ticket/:token —
// оба раньше дублировали одну и ту же вёрстку "пузырей" с небольшими
// расхождениями в подписях (Support/You/email). Собирать итоговый список
// ThreadMessage — забота каждой страницы (она знает, кто смотрит), сам
// компонент просто рисует чат с аватаркой-инициалами на сообщение, как в
// обычных тикет-системах, а не абзацы подряд без разделения по автору.
export function TicketThread({ messages }: TicketThreadProps) {
    return (
        <div className={styles.thread}>
            {messages.map(m => (
                <div key={m.id} className={styles.message}>
                    <Avatar label={m.authorLabel} isSupport={m.isSupport} />
                    <div className={styles.bubbleCol}>
                        <div className={styles.bubbleHead}>
                            <span className={styles.author}>{m.authorLabel}</span>
                            <span className={styles.time}>{m.time}</span>
                        </div>
                        <div className={`${styles.bubble} ${m.isSupport ? styles.bubbleSupport : ''}`}>{m.message}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
