import type { ReactNode } from 'react';
import { SiteHeader } from '../site-header';
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

// Двухколоночная раскладка register/login/verify — тот же язык, что на
// главной (badge с пульсом, капс-заголовок со skew-плашкой — см. pages/
// sign-in), а не изолированная "карточка форм" (widgets/auth-card),
// которая визуально не была похожа на остальной продукт. Правая
// карточка нарочно более плоская/жёсткая (border-radius 6px, акцентный
// кант сверху, прямоугольная кнопка), чем мягкие скруглённые элементы
// слева — это намеренный контраст, одобренный в макетах (вариант J).
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
            <SiteHeader />
            <main className={styles.main}>
                <div className={styles.left}>
                    <div className={styles.badge}>
                        <span className={styles.dot} aria-hidden="true" />
                        {badge}
                    </div>
                    <h1 className={styles.heading}>{heading}</h1>
                    {lead && <p className={styles.lead}>{lead}</p>}
                    {leftExtra}
                </div>
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
            </main>
        </div>
    );
}
