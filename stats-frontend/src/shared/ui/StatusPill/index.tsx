import styles from './index.module.scss';

// Статус-пилюля с точкой (а не просто цветной текст) — тот же язык, что у
// профессиональных тикет-систем (DigitalOcean/Linear): статус должен
// считываться на бегу, по форме и цвету, не только по слову.
export function StatusPill({ status }: { status: 'open' | 'closed' }) {
    return (
        <span className={`${styles.pill} ${status === 'open' ? styles.open : styles.closed}`}>
            <span className={styles.dot} aria-hidden="true" />
            {status === 'open' ? 'Open' : 'Closed'}
        </span>
    );
}
