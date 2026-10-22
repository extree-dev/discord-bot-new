import styles from './index.module.scss';

interface StatCardProps {
    title: string;
    value: string | number;
    suffix?: string;
}

export function StatCard({ title, value, suffix }: StatCardProps) {
    return (
        <div className={styles.card}>
            <div className={styles.title}>{title}</div>
            <div className={styles.value}>
                {value}
                {suffix && <span>{suffix}</span>}
            </div>
        </div>
    );
}
