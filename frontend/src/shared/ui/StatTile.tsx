import styles from './StatTile.module.css';

interface StatTileProps {
    label: string;
    value: string | number | null;
    hint?: string;
}

// value === null — не "0", а "данные недоступны" (например, Discord не
// ответил на запрос approximate-счётчиков) — показываем прочерк, а не
// вводящий в заблуждение ноль.
export function StatTile({ label, value, hint }: StatTileProps) {
    return (
        <div className={styles.tile}>
            <span className={styles.label}>{label}</span>
            <span className={value === null ? `${styles.value} ${styles.muted}` : styles.value}>
                {value === null ? '—' : value}
            </span>
            {hint && <span className={styles.hint}>{hint}</span>}
        </div>
    );
}
