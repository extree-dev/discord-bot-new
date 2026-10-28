import type { ReactNode } from 'react';
import styles from './index.module.scss';

interface SplitAuthLayoutProps {
    badge: ReactNode;
    heading: ReactNode;
    lead?: ReactNode;
    leftExtra?: ReactNode;
    cardTitle: string;
    error?: string | null;
    children: ReactNode;
    footer?: ReactNode;
}

// Форма по центру, без хедера. Поля — полоска снизу, кнопки — капсулы.
export function SplitAuthLayout({
    badge,
    heading,
    lead,
    leftExtra,
    cardTitle,
    error,
    children,
    footer,
}: SplitAuthLayoutProps) {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <div className={styles.sheet}>
                    <div className={styles.badge} aria-hidden="true">
                        {badge}
                    </div>
                    <h1 className={styles.heading}>{heading}</h1>
                    {lead && <p className={styles.lead}>{lead}</p>}
                    {leftExtra && <div className={styles.leftExtra}>{leftExtra}</div>}
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>{cardTitle}</h2>
                        {error && (
                            <p className={styles.error} role="alert">
                                {error}
                            </p>
                        )}
                        {children}
                        {footer && <div className={styles.footer}>{footer}</div>}
                    </div>
                </div>
            </main>
        </div>
    );
}
