import styles from './index.module.scss';

export type TicketStatus = 'open' | 'in_progress' | 'closed';

const LABELS: Record<TicketStatus, string> = {
    open: 'Open',
    in_progress: 'In progress',
    closed: 'Closed',
};

const CLASS: Record<TicketStatus, string> = {
    open: 'open',
    in_progress: 'inProgress',
    closed: 'closed',
};

// Статус-пилюля с точкой (а не просто цветной текст) — тот же язык, что у
// профессиональных тикет-систем (DigitalOcean/Linear): статус должен
// считываться на бегу, по форме и цвету, не только по слову.
export function StatusPill({ status }: { status: TicketStatus }) {
    return (
        <span className={`${styles.pill} ${styles[CLASS[status]]}`}>
            <span className={styles.dot} aria-hidden="true" />
            {LABELS[status]}
        </span>
    );
}
