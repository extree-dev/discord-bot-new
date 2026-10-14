import type { ReactNode } from 'react';
import { ArrowUpRightIcon } from '../../shared/ui/icons';
import styles from './index.module.scss';

interface AppShellProps {
    children: ReactNode;
}

// Каркас редактора визитки (/admin) — визуально это та же светлая
// карточная визитка, которую он редактирует (те же CSS-переменные,
// шрифты, капсула-навигация), а не отдельный тёмный "дашборд"-шелл:
// страница редактирования и её результат должны читаться как одно и
// то же место. Справа в капсуле — прямая ссылка на публичную страницу:
// единственное место, откуда редактирующий визитку админ может сразу
// открыть результат своих правок.
export function AppShell({ children }: AppShellProps) {
    return (
        <div className={styles.shell}>
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
