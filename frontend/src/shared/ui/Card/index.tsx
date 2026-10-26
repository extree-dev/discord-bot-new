import type { ReactNode } from 'react';
import styles from './index.module.scss';

interface CardProps {
    children: ReactNode;
    wide?: boolean;
    className?: string;
}

export function Card({ children, wide = false, className }: CardProps) {
    const base = wide ? `${styles.card} ${styles.wide}` : styles.card;
    return <div className={className ? `${base} ${className}` : base}>{children}</div>;
}
