import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LogoutButton } from '../../features/discord-auth/LogoutButton';
import { useSiteAdminGate } from '../../shared/lib/useSiteAdminGate';
import { ActivityIcon, ChevronLeftIcon, GridIcon, ShieldIcon, VoiceIcon } from '../../shared/ui/icons';
import { Card } from '../../shared/ui/Card';
import { Notice } from '../../shared/ui/Notice';
import { LoginMethods } from '../login-methods/LoginMethods';
import styles from './AdminShell.module.css';

const NAV_ITEMS = [
    { to: '/dashboard', label: 'Обзор', end: true, icon: <GridIcon /> },
    { to: '/dashboard/settings', label: 'Безопасность', icon: <ShieldIcon /> },
    { to: '/dashboard/status', label: 'Статус бота', icon: <ActivityIcon /> },
    { to: '/dashboard/voice', label: 'Голосовые комнаты', icon: <VoiceIcon /> },
];

const COLLAPSE_KEY = 'extree-admin-sidebar-collapsed';

function readCollapsed(): boolean {
    try {
        return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
        return false;
    }
}

// Единый гейт всего кабинета (не только отдельных страниц) — весь раздел
// /dashboard/* это панель управления ОДНИМ конкретным ботом (GUILD_ID),
// а не многосерверный SaaS, поэтому "залогинен" недостаточно: кабинет
// целиком виден только администратору сервера, на котором работает
// Extree. Раньше у каждой страницы был свой экран логина — теперь один,
// здесь, а страницы внутри <Outlet/> уже гарантированно знают, что перед
// ними администратор.
export function AdminShell() {
    const { status, authError } = useSiteAdminGate();
    const [collapsed, setCollapsed] = useState(readCollapsed);

    useEffect(() => {
        try {
            localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
        } catch {
            // приватный режим браузера и т.п. — сворачивание просто не
            // переживёт перезагрузку страницы, не критично.
        }
    }, [collapsed]);

    if (status === 'loading') {
        return <div className={styles.shell} />;
    }

    if (status === 'logged-out') {
        return (
            <div className={styles.shell}>
                <div className={styles.glow} aria-hidden="true" />
                <header className={styles.topbar}>
                    <a className={styles.brand} href="/">
                        <span className={styles.badge}>E</span>Extree
                    </a>
                </header>
                <main className={styles.centered}>
                    <Card>
                        <h1>Панель управления</h1>
                        <p>
                            Войди через Discord — доступ есть только у администратора сервера, на котором работает бот.
                        </p>
                        {authError && (
                            <Notice variant="error">Вход не завершился — ссылка устарела. Попробуй ещё раз.</Notice>
                        )}
                        <LoginMethods />
                    </Card>
                </main>
            </div>
        );
    }

    if (status === 'denied') {
        return (
            <div className={styles.shell}>
                <div className={styles.glow} aria-hidden="true" />
                <header className={styles.topbar}>
                    <a className={styles.brand} href="/">
                        <span className={styles.badge}>E</span>Extree
                    </a>
                </header>
                <main className={styles.centered}>
                    <Card>
                        <h1>Нет доступа</h1>
                        <p>Панель управления доступна только администратору сервера, на котором работает Extree.</p>
                        <LogoutButton />
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.shell}>
            <div className={styles.glow} aria-hidden="true" />
            <header className={styles.topbar}>
                <a className={styles.brand} href="/">
                    <span className={styles.badge}>E</span>Extree
                </a>
                <LogoutButton fullWidth={false} />
            </header>
            <div className={`${styles.body} ${collapsed ? styles.bodyCollapsed : ''}`}>
                <nav className={styles.sidebar}>
                    <div className={styles.navLinks}>
                        {NAV_ITEMS.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                title={collapsed ? item.label : undefined}
                                className={({ isActive }) =>
                                    isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                                }
                            >
                                <span className={styles.navIcon}>{item.icon}</span>
                                <span className={styles.navLabel}>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                    <button
                        type="button"
                        className={styles.collapseToggle}
                        onClick={() => setCollapsed(c => !c)}
                        title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
                    >
                        <span className={styles.collapseIcon} data-collapsed={collapsed}>
                            <ChevronLeftIcon />
                        </span>
                        <span className={styles.navLabel}>Свернуть</span>
                    </button>
                </nav>
                <main className={styles.content}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
