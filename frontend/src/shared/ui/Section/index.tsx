import type { ReactNode } from 'react';
import styles from './index.module.scss';

interface SectionProps {
    id?: string;
    label: string;
    /** true — секция идёт сразу после hero и не имеет верхней границы. */
    flush?: boolean;
    children: ReactNode;
}

// Каркас секции: вертикальная подпись слева + контент справа.
// Используется AboutSection, ContactSection, а в будущем — всеми
// секциями-списками (tools, clients, communities).
export function Section({ id, label, flush, children }: SectionProps) {
    return (
        <section id={id} className={flush ? `${styles.section} ${styles.flush}` : styles.section}>
            <span className={styles.label}>{label}</span>
            <div className={styles.body}>{children}</div>
        </section>
    );
}
