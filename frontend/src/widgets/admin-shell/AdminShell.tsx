import { NavLink, Outlet } from 'react-router-dom';
import { LoginButton } from '../../features/discord-auth/LoginButton';
import { LogoutButton } from '../../features/discord-auth/LogoutButton';
import { useSiteAdminGate } from '../../shared/lib/useSiteAdminGate';
import { Card } from '../../shared/ui/Card';
import { Notice } from '../../shared/ui/Notice';
import styles from './AdminShell.module.css';

const NAV_ITEMS = [
    { to: '/dashboard', label: 'Обзор', end: true },
    { to: '/dashboard/settings', label: 'Безопасность' },
    { to: '/dashboard/status', label: 'Статус бота' },
];

// Единый гейт всего кабинета (не только отдельных страниц) — весь раздел
// /dashboard/* это панель управления ОДНИМ конкретным ботом (GUILD_ID),
// а не многосерверный SaaS, поэтому "залогинен" недостаточно: кабинет
// целиком виден только администратору сервера, на котором работает
// Extree. Раньше у каждой страницы был свой экран логина — теперь один,
// здесь, а DashboardPage/BotSettingsPage/BotStatusPage внутри <Outlet/>
// уже гарантированно знают, что перед ними администратор.
export function AdminShell() {
    const { status, authError } = useSiteAdminGate();

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
                        <LoginButton />
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
                <LogoutButton />
            </header>
            <div className={styles.body}>
                <nav className={styles.sidebar}>
                    {NAV_ITEMS.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) =>
                                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <main className={styles.content}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
