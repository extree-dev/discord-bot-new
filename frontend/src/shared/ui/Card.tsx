import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
    children: ReactNode;
    wide?: boolean;
}

export function Card({ children, wide = false }: CardProps) {
    return (
        <>
            <div className={styles.glow} />
            <main className={wide ? `${styles.card} ${styles.wide}` : styles.card}>{children}</main>
        </>
    );
}
