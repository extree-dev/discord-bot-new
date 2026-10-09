import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { getSession } from '../../entities/session/api';
import type { SessionUser } from '../../entities/session/types';
import { LogoutButton } from '../../features/discord-auth/LogoutButton';
import { useSiteAdminGate } from '../../shared/lib/useSiteAdminGate';
import { gateNoticeMessage } from '../../shared/lib/gateNotice';
import { useTheme } from '../../shared/lib/useTheme';
import { useLang } from '../../shared/lib/useLang';
import type { TranslationKey } from '../../shared/lib/i18n/translations';
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
import { BrandMark } from '../../shared/ui/BrandMark';
import { Card } from '../../shared/ui/Card';
import { Notice } from '../../shared/ui/Notice';
import { ThemeToggle } from '../../shared/ui/ThemeToggle';
import { LanguageToggle } from '../../shared/ui/LanguageToggle';
import { AuthSplitScreen } from '../auth-split-screen/AuthSplitScreen';
import styles from './AdminShell.module.css';

const NAV_ITEMS: { to: string; end?: boolean; labelKey: TranslationKey; icon: ReactNode }[] = [
    { to: '/dashboard', end: true, labelKey: 'nav.overview', icon: <GridIcon /> },
    { to: '/dashboard/members', labelKey: 'nav.members', icon: <UsersIcon /> },
    { to: '/dashboard/muted', labelKey: 'nav.muted', icon: <MuteIcon /> },
    { to: '/dashboard/banned', labelKey: 'nav.banned', icon: <BanIcon /> },
    { to: '/dashboard/leaderboard', labelKey: 'nav.leaderboard', icon: <LevelsIcon /> },
    { to: '/dashboard/settings', labelKey: 'nav.security', icon: <ShieldIcon /> },
    { to: '/dashboard/status', labelKey: 'nav.status', icon: <ActivityIcon /> },
    { to: '/dashboard/voice', labelKey: 'nav.voice', icon: <VoiceIcon /> },
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
    const { theme, toggleTheme } = useTheme();
    const { lang, toggleLang, t } = useLang();

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
        return <div className={styles.shell} data-theme={theme} />;
    }

    if (status === 'logged-out') {
        return <AuthSplitScreen notice={notice} />;
    }

    if (status === 'denied') {
        return (
            <div className={styles.deniedShell} data-theme={theme}>
                <header className={styles.deniedTopbar}>
                    <a className={styles.deniedBrand} href="/">
                        <BrandMark className={styles.deniedBadge} />
                        Extree
                    </a>
                </header>
                <main className={styles.deniedCentered}>
                    <Card>
                        <h1>{t('denied.title')}</h1>
                        <p>{t('denied.text')}</p>
                        <LogoutButton label={t('sidebar.logout')} />
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className={`${styles.shell} ${collapsed ? styles.shellCollapsed : ''}`} data-theme={theme}>
            <aside className={styles.sidebar}>
                <div className={styles.brandRow}>
                    <a className={styles.brand} href="/">
                        <BrandMark className={styles.badge} />
                        <span className={styles.brandLabel}>Extree</span>
                    </a>
                </div>

                <div className={styles.toolsRow}>
                    <ThemeToggle theme={theme} onToggle={toggleTheme} />
                    <LanguageToggle lang={lang} onToggle={toggleLang} />
                </div>

                {user && (
                    <div className={styles.profile}>
                        <Avatar src={user.avatarUrl} alt="" size="tiny" />
                        <div className={styles.profileText}>
                            <span className={styles.profileName}>{user.username}</span>
                            <span className={styles.profileRole}>{t('profile.role')}</span>
                        </div>
                    </div>
                )}

                <nav className={styles.navLinks}>
                    {NAV_ITEMS.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            title={collapsed ? t(item.labelKey) : undefined}
                            className={({ isActive }) =>
                                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                            }
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            <span className={styles.navLabel}>{t(item.labelKey)}</span>
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
                        <span className={styles.navLabel}>{t('sidebar.collapse')}</span>
                    </button>
                    <LogoutButton fullWidth label={t('sidebar.logout')} />
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
