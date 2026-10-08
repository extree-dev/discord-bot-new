import type { ReactNode } from 'react';
import { ArrowUpRightIcon } from '../../shared/ui/icons';
import styles from './AppShell.module.css';

interface AppShellProps {
    children: ReactNode;
}

// Каркас редактора визитки (/admin) — фирменный хедер и фон рендерятся
// всегда, сразу, даже пока содержимое карточки ещё грузится, вместо
// пустого экрана или одинокой плавающей карточки без единого якоря
// бренда. Справа в хедере — прямая ссылка на публичную страницу: это
// единственное место, откуда редактирующий визитку админ может сразу
// открыть результат своих правок.
export function AppShell({ children }: AppShellProps) {
    return (
        <div className={styles.shell}>
            <div className={styles.glow} aria-hidden="true" />
            <header className={styles.header}>
                <a className={styles.brand} href="/">
                    <span className={styles.badge}>E</span>
                    Extree
                </a>
                <a className={styles.preview} href="/" target="_blank" rel="noreferrer">
                    <span className={styles.previewLabel}>Открыть визитку</span>
                    <ArrowUpRightIcon />
                </a>
            </header>
            <main className={styles.main}>{children}</main>
        </div>
    );
}
