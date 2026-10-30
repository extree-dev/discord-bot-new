import type { ReactNode } from 'react';
import styles from './index.module.scss';

interface ErrorBannerProps {
    children: ReactNode;
    className?: string;
}

export function ErrorBanner({ children, className }: ErrorBannerProps) {
    return (
        <p className={`${styles.banner} ${className ?? ''}`} role="alert">
            {children}
        </p>
    );
}
