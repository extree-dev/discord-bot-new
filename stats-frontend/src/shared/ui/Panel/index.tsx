import type { ReactNode } from 'react';
import styles from './index.module.scss';

interface PanelProps {
    title?: string;
    subtitle?: string;
    headerExtra?: ReactNode;
    noBodyPadding?: boolean;
    className?: string;
    children: ReactNode;
}

// Карточка-секция для широких "рабочих" страниц (аккаунт, тикеты) — в
// отличие от AuthCard (одна узкая карточка на весь экран, под формы
// входа), страница тут складывается из нескольких Panel одна под другой,
// как в обычных SaaS-дашбордах: профиль отдельно, смена пароля отдельно,
// история входов отдельно, а не всё в одной форме.
export function Panel({ title, subtitle, headerExtra, noBodyPadding, className, children }: PanelProps) {
    return (
        <section className={`${styles.panel} ${className ?? ''}`}>
            {title && (
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>{title}</h2>
                        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                    </div>
                    {headerExtra}
                </div>
            )}
            <div className={noBodyPadding ? undefined : styles.body}>{children}</div>
        </section>
    );
}
