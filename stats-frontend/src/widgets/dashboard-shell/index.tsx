import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
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
} from '../../shared/ui/Icons';
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
    return `${styles.navLink} ${isActive ? styles.active : ''}`;
}

// Редизайн 4: расположение элементов, а не только материал/цвет —
// сайдбар слева (неизменный во всех прошлых версиях) заменён на
// горизонтальный топбар на всю ширину: лого слева, пункты меню по
// центру/справа от него, аватар с одной кнопкой "выйти" у правого края
// (не выпадающее меню). На мобильном то же самое сжимается в гамбургер,
// открывающий панель СВЕРХУ под хедером (а не bottom sheet снизу, как
// было раньше).
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
    const [menuOpen, setMenuOpen] = useState(false);
    const closeMenu = () => setMenuOpen(false);

    return (
        <div className={styles.shell}>
            <header className={styles.topbar}>
                <Link to="/" className={styles.brand}>
                    <img src="/logo.png" alt="" className={styles.mark} aria-hidden="true" />
                    <span>Extree Stats</span>
                </Link>

                {user && (
                    <nav className={styles.navLinks}>
                        <NavLink to="/account" end className={navClass}>
                            Dashboard
                        </NavLink>
                        <NavLink to="/account/settings" className={navClass}>
                            Settings
                        </NavLink>
                        <NavLink to="/support" className={navClass}>
                            Support
                        </NavLink>
                        {user.isAdmin && (
                            <>
                                <span className={styles.navDivider} aria-hidden="true" />
                                <NavLink to="/admin/users" className={navClass}>
                                    Users
                                </NavLink>
                                <NavLink to="/admin/tickets" className={navClass}>
                                    Tickets
                                </NavLink>
                                <NavLink to="/admin/audit" className={navClass}>
                                    Audit Log
                                </NavLink>
                            </>
                        )}
                    </nav>
                )}

                {user && (
                    <div className={styles.topbarRight}>
                        <div className={styles.userChip}>
                            <Avatar label={user.email} />
                            <span className={styles.userEmail} title={user.email}>
                                {user.email}
                            </span>
                        </div>
                        <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={signOut}
                            title="Sign out"
                            aria-label="Sign out"
                        >
                            <PowerIcon />
                        </button>
                        <button
                            type="button"
                            className={styles.menuToggle}
                            onClick={() => setMenuOpen(o => !o)}
                            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={menuOpen}
                        >
                            {menuOpen ? <IconX /> : <MenuIcon />}
                        </button>
                    </div>
                )}
            </header>

            {menuOpen && user && (
                <>
                    <div className={styles.menuBackdrop} onClick={closeMenu} aria-hidden="true" />
                    <nav className={styles.mobileMenu} aria-label="Menu">
                        <NavLink to="/account" end className={navClass} onClick={closeMenu}>
                            <HomeIcon />
                            Dashboard
                        </NavLink>
                        <NavLink to="/account/settings" className={navClass} onClick={closeMenu}>
                            <SettingsIcon />
                            Settings
                        </NavLink>
                        <NavLink to="/support" className={navClass} onClick={closeMenu}>
                            <TicketIcon />
                            Support
                        </NavLink>
                        {user.isAdmin && (
                            <>
                                <div className={styles.navLabel}>Admin</div>
                                <NavLink to="/admin/users" className={navClass} onClick={closeMenu}>
                                    <UsersIcon />
                                    Manage Users
                                </NavLink>
                                <NavLink to="/admin/tickets" className={navClass} onClick={closeMenu}>
                                    <TicketIcon />
                                    Tickets
                                </NavLink>
                                <NavLink to="/admin/audit" className={navClass} onClick={closeMenu}>
                                    <ShieldIcon />
                                    Audit Log
                                </NavLink>
                            </>
                        )}
                        <button type="button" className={styles.navLink} onClick={signOut}>
                            <PowerIcon />
                            Sign out
                        </button>
                    </nav>
                </>
            )}

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
