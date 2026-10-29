import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Avatar } from '../../shared/ui/Avatar';
import {
    HomeIcon,
    SettingsIcon,
    TicketIcon,
    ShieldIcon,
    UsersIcon,
    PowerIcon,
    MenuIcon,
    IconX,
    UserIcon,
    BellIcon,
} from '../../shared/ui/Icons';
import styles from './index.module.scss';

export function DashboardShell({ user, breadcrumb, title, subtitle, headerExtra, error, wide, children }: any) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const location = useLocation();
    const isSettingsActive = location.pathname.includes('/account/settings');
    const signOut = () => {
        window.location.href = '/auth/logout';
    };
    const navClass = ({ isActive }: { isActive: boolean }) => `${styles.navLink} ${isActive ? styles.active : ''}`;

    return (
        <div className={styles.shell}>
            <button className={styles.mobileToggle} onClick={() => setSidebarOpen(true)}>
                <MenuIcon />
            </button>
            {sidebarOpen && <div className={styles.sidebarBackdrop} onClick={() => setSidebarOpen(false)} />}

            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarHeader}>
                    <Link to="/" className={styles.brand}>
                        <img src="/logo.png" alt="" className={styles.mark} />
                        <span>EXTREE</span>
                    </Link>
                    <button className={styles.closeSidebar} onClick={() => setSidebarOpen(false)}>
                        <IconX />
                    </button>
                </div>

                {user && (
                    <nav className={styles.nav}>
                        <NavLink to="/account" end className={navClass} onClick={() => setSidebarOpen(false)}>
                            <HomeIcon /> Dashboard
                        </NavLink>

                        <div className={styles.navGroup}>
                            <button
                                className={`${styles.navLink} ${isSettingsActive ? styles.active : ''}`}
                                onClick={() => setSettingsOpen(o => !o)}
                            >
                                <SettingsIcon /> Settings
                                <span className={`${styles.chevron} ${settingsOpen ? styles.chevronOpen : ''}`}>
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="m6 9 6 6 6-6" />
                                    </svg>
                                </span>
                            </button>
                            <div className={`${styles.subMenu} ${settingsOpen ? styles.subMenuOpen : ''}`}>
                                <div>
                                    <NavLink
                                        to="/account/settings"
                                        end
                                        className={navClass}
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        <UserIcon /> Profile
                                    </NavLink>
                                    <NavLink
                                        to="/account/settings?tab=security"
                                        className={navClass}
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        <ShieldIcon /> Security
                                    </NavLink>
                                    <NavLink
                                        to="/account/settings?tab=notifications"
                                        className={navClass}
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        <BellIcon /> Notifications
                                    </NavLink>
                                </div>
                            </div>
                        </div>

                        <NavLink to="/support" className={navClass} onClick={() => setSidebarOpen(false)}>
                            <TicketIcon /> Support
                        </NavLink>

                        {user.isAdmin && (
                            <>
                                <div className={styles.navLabel}>Admin Area</div>
                                <NavLink to="/admin/users" className={navClass} onClick={() => setSidebarOpen(false)}>
                                    <UsersIcon /> Manage Users
                                </NavLink>
                                <NavLink to="/admin/tickets" className={navClass} onClick={() => setSidebarOpen(false)}>
                                    <TicketIcon /> Tickets
                                </NavLink>
                                <NavLink to="/admin/audit" className={navClass} onClick={() => setSidebarOpen(false)}>
                                    <ShieldIcon /> Audit Log
                                </NavLink>
                            </>
                        )}
                    </nav>
                )}

                {user && (
                    <div className={styles.sidebarFooter}>
                        <div className={styles.userChip}>
                            <Avatar label={user.email} />
                            <span className={styles.userEmail}>{user.email}</span>
                        </div>
                        <button className={styles.signOutBtn} onClick={signOut}>
                            <PowerIcon />
                        </button>
                    </div>
                )}
            </aside>

            <main className={styles.main}>
                <div className={`${styles.content} ${wide ? styles.contentWide : ''}`}>
                    <div className={styles.pageHead}>
                        <div>
                            {breadcrumb && (
                                <Link to={breadcrumb.to} className={styles.breadcrumb}>
                                    ← {breadcrumb.label}
                                </Link>
                            )}
                            <h1 className={styles.pageTitle}>{title}</h1>
                            {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
                        </div>
                        {headerExtra}
                    </div>
                    {error && <p className={styles.error}>{error}</p>}
                    {children}
                </div>
            </main>
        </div>
    );
}
