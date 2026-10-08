import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { getSession } from '../../entities/session/api';
import type { SessionUser } from '../../entities/session/types';
import { LogoutButton } from '../../features/discord-auth/LogoutButton';
import { useSiteAdminGate } from '../../shared/lib/useSiteAdminGate';
import { gateNoticeMessage } from '../../shared/lib/gateNotice';
import {
    ActivityIcon,
    BanIcon,
    ChevronLeftIcon,
    GridIcon,
    LevelsIcon,
    MuteIcon,
    ShieldIcon,
    UsersIcon,
    VoiceIcon,
} from '../../shared/ui/icons';
import { Avatar } from '../../shared/ui/Avatar';
import { Card } from '../../shared/ui/Card';
import { Notice } from '../../shared/ui/Notice';
import { AuthSplitScreen } from '../auth-split-screen/AuthSplitScreen';
import styles from './AdminShell.module.css';

const NAV_ITEMS = [
    { to: '/dashboard', label: 'Обзор', end: true, icon: <GridIcon /> },
    { to: '/dashboard/members', label: 'Участники', icon: <UsersIcon /> },
    { to: '/dashboard/muted', label: 'В муте', icon: <MuteIcon /> },
    { to: '/dashboard/banned', label: 'Заблокированные', icon: <BanIcon /> },
    { to: '/dashboard/leaderboard', label: 'Уровни', icon: <LevelsIcon /> },
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
//
// Светлая тема здесь — локальный оверрайд CSS-переменных на корневом
// .shell (AdminShell.module.css), тем же приёмом, что у AuthSplitScreen:
// вложенные Card/Button/Field/Notice/DataTable подхватывают светлые
// цвета автоматически через каскад, без собственной копии каждого
// компонента и без изменения тёмной темы остального сайта (bot-site,
// extree.tech/admin).
export function AdminShell() {
    const { status, notice } = useSiteAdminGate();
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const [user, setUser] = useState<SessionUser | null>(null);

    useEffect(() => {
        try {
            localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
        } catch {
            // приватный режим браузера и т.п. — сворачивание просто не
            // переживёт перезагрузку страницы, не критично.
        }
    }, [collapsed]);

    useEffect(() => {
        if (status !== 'admin') return;
        let cancelled = false;
        getSession().then(({ user: sessionUser }) => {
            if (!cancelled) setUser(sessionUser);
        });
        return () => {
            cancelled = true;
        };
    }, [status]);

    if (status === 'loading') {
        return <div className={styles.shell} />;
    }

    if (status === 'logged-out') {
        return <AuthSplitScreen notice={notice} />;
    }

    if (status === 'denied') {
        return (
            <div className={styles.deniedShell}>
                <header className={styles.deniedTopbar}>
                    <a className={styles.deniedBrand} href="/">
                        <span className={styles.deniedBadge}>E</span>Extree
                    </a>
                </header>
                <main className={styles.deniedCentered}>
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
        <div className={`${styles.shell} ${collapsed ? styles.shellCollapsed : ''}`}>
            <aside className={styles.sidebar}>
                <a className={styles.brand} href="/">
                    <span className={styles.badge}>E</span>
                    <span className={styles.brandLabel}>Extree</span>
                </a>

                {user && (
                    <div className={styles.profile}>
                        <Avatar src={user.avatarUrl} alt="" size="tiny" />
                        <div className={styles.profileText}>
                            <span className={styles.profileName}>{user.username}</span>
                            <span className={styles.profileRole}>Администратор</span>
                        </div>
                    </div>
                )}

                <nav className={styles.navLinks}>
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
                </nav>

                <div className={styles.sidebarFooter}>
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
                    <LogoutButton fullWidth />
                </div>
            </aside>
            <main className={styles.content}>
                <div className={styles.contentInner}>
                    {notice && (
                        <Notice variant={gateNoticeMessage(notice).variant}>{gateNoticeMessage(notice).text}</Notice>
                    )}
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
