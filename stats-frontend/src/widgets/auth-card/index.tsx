import type { ReactNode } from 'react';
import { SiteHeader } from '../site-header';
import styles from './index.module.scss';

interface AuthCardProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
    error?: string | null;
}

// Общая обёртка для register/login/verify — те же токены и структура,
// что у остального продукта (SiteHeader, мягкое ambient-свечение из
// pages/sign-in), просто центрированная карточка вместо двухколоночной
// раскладки — под короткую форму это уместнее.
export function AuthCard({ title, subtitle, children, footer, error }: AuthCardProps) {
    return (
        <div className={styles.page}>
            <div className={styles.ambient} aria-hidden="true" />
            <SiteHeader />
            <main className={styles.stage}>
                <div className={styles.card}>
                    <h1 className={styles.title}>{title}</h1>
                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                    {error && (
                        <p className={styles.error} role="alert">
                            {error}
                        </p>
                    )}
                    {children}
                    {footer && <div className={styles.footer}>{footer}</div>}
                </div>
            </main>
        </div>
    );
}
