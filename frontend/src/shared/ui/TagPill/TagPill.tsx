import type { ReactNode } from 'react';
import styles from './TagPill.module.css';

interface TagPillProps {
    children: ReactNode;
}

export function TagPill({ children }: TagPillProps) {
    return <span className={styles.pill}>{children}</span>;
}