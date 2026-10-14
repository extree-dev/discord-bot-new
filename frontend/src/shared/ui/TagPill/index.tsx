import type { ReactNode } from 'react';
import styles from './index.module.scss';

interface TagPillProps {
    children: ReactNode;
}

export function TagPill({ children }: TagPillProps) {
    return <span className={styles.pill}>{children}</span>;
}
