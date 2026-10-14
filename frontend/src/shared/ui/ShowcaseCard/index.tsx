import type { ReactNode } from 'react';
import styles from './index.module.scss';

interface ShowcaseCardProps {
    children: ReactNode;
}

export function ShowcaseCard({ children }: ShowcaseCardProps) {
    return <article className={styles.card}>{children}</article>;
}
