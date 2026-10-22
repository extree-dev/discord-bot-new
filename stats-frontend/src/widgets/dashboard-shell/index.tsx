import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ProfileDropdown } from '../../shared/ui/ProfileDropdown';
import styles from './index.module.scss';

interface DashboardUser {
    email: string;
    isAdmin: boolean;
}

interface DashboardShellProps {
    user: DashboardUser | null;
    breadcrumb?: { to: string; label: string };
    title: string;
    subtitle?: string;
    headerExtra?: ReactNode;
    error?: string | null;
    wide?: boolean;
    children: ReactNode;
}

export function DashboardShell({
    user,
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

                <div className={styles.spacer} />

                {user && (
                    <div className={styles.userMenu}>
                        <ProfileDropdown email={user.email} isAdmin={user.isAdmin} />
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
