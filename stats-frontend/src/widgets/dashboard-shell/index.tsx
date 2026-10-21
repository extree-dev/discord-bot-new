import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './index.module.scss';

interface DashboardUser {
    email: string;
    isAdmin: boolean;
}

interface DashboardShellProps {
    user: DashboardUser | null;
    active?: 'account' | 'tickets';
    breadcrumb?: { to: string; label: string };
    title: string;
    subtitle?: string;
    headerExtra?: ReactNode;
    error?: string | null;
    wide?: boolean;
    children: ReactNode;
}

// Раскладка для "рабочих" (не auth-) экранов Extree Stats — аккаунт,
// тикеты. В отличие от AuthCard (одна узкая карточка под формы входа),
// тут настоящая верхняя навигация (бренд + вкладки + юзер-меню) и широкий
// контент из нескольких Panel — тот же каркас, что у профессиональных
// SaaS-панелей (DigitalOcean/Linear), а не центрированная форма.
export function DashboardShell({
    user,
    active,
    breadcrumb,
    title,
    subtitle,
    headerExtra,
    error,
    wide,
    children,
}: DashboardShellProps) {
    return (
        <div className={styles.page}>
            <header className={styles.topbar}>
                <Link to="/" className={styles.brandLink}>
                    <img src="/logo.png" alt="" className={styles.mark} aria-hidden="true" />
                    <span className={styles.brand}>Extree Stats</span>
                </Link>
                {user && (
                    <nav className={styles.nav}>
                        <Link
                            to="/account"
                            className={`${styles.navLink} ${active === 'account' ? styles.navLinkActive : ''}`}
                        >
                            Account
                        </Link>
                        {user.isAdmin && (
                            <Link
                                to="/admin/tickets"
                                className={`${styles.navLink} ${active === 'tickets' ? styles.navLinkActive : ''}`}
                            >
                                Tickets
                            </Link>
                        )}
                    </nav>
                )}
                <div className={styles.spacer} />
                {user && (
                    <div className={styles.userMenu}>
                        <span className={styles.userEmail}>{user.email}</span>
                        <a className={styles.signOut} href="/auth/logout">
                            Sign out
                        </a>
                    </div>
                )}
            </header>

            <main className={styles.main}>
                <div className={`${styles.content} ${wide ? styles.contentWide : ''}`}>
                    <div>
                        {breadcrumb && (
                            <Link to={breadcrumb.to} className={styles.breadcrumb}>
                                ← {breadcrumb.label}
                            </Link>
                        )}
                        <div className={styles.pageHead}>
                            <div>
                                <h1 className={styles.pageTitle}>{title}</h1>
                                {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
                            </div>
                            {headerExtra}
                        </div>
                    </div>
                    {error && (
                        <p className={styles.error} role="alert">
                            {error}
                        </p>
                    )}
                    {children}
                </div>
            </main>
        </div>
    );
}
