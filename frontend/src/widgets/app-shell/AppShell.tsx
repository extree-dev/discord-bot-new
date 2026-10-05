import type { ReactNode } from 'react';
import styles from './AppShell.module.css';

interface AppShellProps {
    children: ReactNode;
}

// Общий каркас для всех четырёх страниц (визитка, её редактор, кабинет,
// настройки бота) — фирменный хедер и фон рендерятся всегда, сразу, даже
// пока содержимое карточки ещё грузится, вместо пустого экрана или
// одинокой плавающей карточки без единого якоря бренда.
export function AppShell({ children }: AppShellProps) {
    return (
        <div className={styles.shell}>
            <div className={styles.glow} aria-hidden="true" />
            <header className={styles.header}>
                <a className={styles.brand} href="/">
                    <span className={styles.badge}>E</span>
                    Extree
                </a>
            </header>
            <main className={styles.main}>{children}</main>
        </div>
    );
}
