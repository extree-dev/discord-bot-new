import type { ReactNode } from 'react';
import styles from './Notice.module.css';

interface NoticeProps {
    variant: 'info' | 'error';
    children: ReactNode;
}

export function Notice({ variant, children }: NoticeProps) {
    return <p className={variant === 'error' ? styles.error : styles.info}>{children}</p>;
}
