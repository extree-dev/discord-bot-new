import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Avatar } from '../../shared/ui/Avatar';
import { HomeIcon, SettingsIcon, TicketIcon, ShieldIcon, UsersIcon, PowerIcon } from '../../shared/ui/Icons';
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

function signOut() {
    window.location.href = '/auth/logout';
}

function navClass({ isActive }: { isActive: boolean }) {
    return `${styles.navItem} ${isActive ? styles.active : ''}`;
}

function tabClass({ isActive }: { isActive: boolean }) {
    return `${styles.tabItem} ${isActive ? styles.active : ''}`;
}

// Редизайн 3: control panel как отдельное приложение, а не страница с
// плавающим топбаром поверх контента — постоянный стеклянный sidebar-dock
// на десктопе (macOS-язык) и нативный bottom tab bar на мобильном (iOS-
// язык), вместо ProfileDropdown-меню, которое раньше было единственным
// входом в навигацию. Админ-разделы (Users/Tickets/Audit) теперь видны
// как постоянные пункты меню, а не спрятаны в выпадашке.
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
    const [sheetOpen, setSheetOpen] = useState(false);
    const closeSheet = () => setSheetOpen(false);

    return (
        <div className={styles.shell}>
            {user && (
                <aside className={styles.sidebar}>
                    <Link to="/" className={styles.brand}>
                        <img src="/logo.png" alt="" className={styles.mark} aria-hidden="true" />
                        <span>Extree Stats</span>
                    </Link>

                    <nav className={styles.nav}>
                        <NavLink to="/account" end className={navClass}>
                            <HomeIcon />
                            Dashboard
                        </NavLink>
                        <NavLink to="/account/settings" className={navClass}>
                            <SettingsIcon />
                            Settings
                        </NavLink>
                        <NavLink to="/support" className={navClass}>
                            <TicketIcon />
                            Support
                        </NavLink>

                        {user.isAdmin && (
                            <>
                                <div className={styles.navLabel}>Admin</div>
                                <NavLink to="/admin/users" className={navClass}>
                                    <UsersIcon />
                                    Manage Users
                                </NavLink>
                                <NavLink to="/admin/tickets" className={navClass}>
                                    <TicketIcon />
                                    Tickets
                                </NavLink>
                                <NavLink to="/admin/audit" className={navClass}>
                                    <ShieldIcon />
                                    Audit Log
                                </NavLink>
                            </>
                        )}
                    </nav>

                    <div className={styles.sidebarFooter}>
                        <Avatar label={user.email} />
                        <span className={styles.footerEmail} title={user.email}>
                            {user.email}
                        </span>
                        <button
                            type="button"
                            className={styles.logoutBtn}
                            onClick={signOut}
                            title="Sign out"
                            aria-label="Sign out"
                        >
                            <PowerIcon />
                        </button>
                    </div>
                </aside>
            )}

            <div className={styles.column}>
                <header className={styles.mobileTopbar}>
                    <Link to="/" className={styles.brand}>
                        <img src="/logo.png" alt="" className={styles.mark} aria-hidden="true" />
                        <span>Extree Stats</span>
                    </Link>
                    {user && (
                        <button
                            type="button"
                            className={styles.mobileAvatarBtn}
                            onClick={() => setSheetOpen(true)}
                            aria-label="Open menu"
                        >
                            <Avatar label={user.email} />
                        </button>
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

            {user && (
                <nav className={styles.tabbar}>
                    <NavLink to="/account" end className={tabClass}>
                        <HomeIcon />
                        <span>Home</span>
                    </NavLink>
                    <NavLink to="/account/settings" className={tabClass}>
                        <SettingsIcon />
                        <span>Settings</span>
                    </NavLink>
                    <NavLink to="/support" className={tabClass}>
                        <TicketIcon />
                        <span>Support</span>
                    </NavLink>
                    {user.isAdmin ? (
                        <button type="button" className={styles.tabItem} onClick={() => setSheetOpen(true)}>
                            <ShieldIcon />
                            <span>Admin</span>
                        </button>
                    ) : (
                        <button type="button" className={styles.tabItem} onClick={signOut}>
                            <PowerIcon />
                            <span>Logout</span>
                        </button>
                    )}
                </nav>
            )}

            {sheetOpen && user && (
                <>
                    <div className={styles.sheetBackdrop} onClick={closeSheet} aria-hidden="true" />
                    <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Menu">
                        <div className={styles.sheetHandle} aria-hidden="true" />
                        <div className={styles.sheetHeader}>
                            <Avatar label={user.email} />
                            <span>{user.email}</span>
                        </div>
                        <div className={styles.sheetList}>
                            <Link to="/account/settings" className={styles.sheetItem} onClick={closeSheet}>
                                <SettingsIcon /> Settings
                            </Link>
                            <Link to="/support" className={styles.sheetItem} onClick={closeSheet}>
                                <TicketIcon /> Support
                            </Link>
                            {user.isAdmin && (
                                <>
                                    <Link to="/admin/users" className={styles.sheetItem} onClick={closeSheet}>
                                        <UsersIcon /> Manage Users
                                    </Link>
                                    <Link to="/admin/tickets" className={styles.sheetItem} onClick={closeSheet}>
                                        <TicketIcon /> Tickets
                                    </Link>
                                    <Link to="/admin/audit" className={styles.sheetItem} onClick={closeSheet}>
                                        <ShieldIcon /> Audit Log
                                    </Link>
                                </>
                            )}
                            <button type="button" className={styles.sheetItem} onClick={signOut}>
                                <PowerIcon /> Sign out
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
