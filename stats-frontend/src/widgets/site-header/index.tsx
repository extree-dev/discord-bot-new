import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../shared/ui/Button';
import { ProfileDropdown } from '../../shared/ui/ProfileDropdown';
import { MenuIcon, IconX } from '../../shared/ui/Icons';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './index.module.scss';

// Кнопка ⌘K — открывает CommandPalette. Слушает keydown на уровне документа
// через хук в CommandPalette, поэтому здесь достаточно dispatch-нуть event.
function CmdKButton() {
    function onClick() {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    }
    return (
        <button type="button" onClick={onClick} className={styles.cmdK} aria-label="Open command palette">
            ⌘K
        </button>
    );
}

export interface SiteHeaderNavLink {
    label: string;
    href: string;
}

interface SiteHeaderProps {
    rightSlot?: ReactNode;
    actions?: ReactNode;
    // Якорные пункты меню (сейчас используется только лендингом) — остальные
    // страницы его не передают, так что для них хедер ведёт себя как раньше.
    navLinks?: SiteHeaderNavLink[];
}

// SRP: только хедер. Если передан явный rightSlot/actions — рендерим их
// (как раньше). Если НЕ переданы — рендерим дефолтные по статусу auth:
// - authenticated → Dashboard + ProfileDropdown
// - anonymous → Log in / Sign up
export function SiteHeader({ rightSlot, actions, navLinks }: SiteHeaderProps) {
    const { status, user } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    // Хедер прозрачный на самом верху страницы и получает сплошной фон +
    // границу только после начала скролла — пока без backdrop-filter: во
    // всём остальном приложении "стекло" намеренно убрали (см. комментарий
    // в app/styles/global.css про "Flat Minimal"), так что здесь это просто
    // сплошной var(--bg), а не блюр.
    useEffect(() => {
        function onScroll() {
            setScrolled(window.scrollY > 8);
        }
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!menuOpen) return;
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') setMenuOpen(false);
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [menuOpen]);

    const showDefaultActions = rightSlot === undefined && actions === undefined;

    const actionsContent = showDefaultActions ? (
        <div className={styles.actions}>
            {status === 'authenticated' && user ? (
                <>
                    <Button href="/account" variant="primary" size="sm">
                        Dashboard
                    </Button>
                    <CmdKButton />
                    <ProfileDropdown email={user.email} isAdmin={user.isAdmin} />
                </>
            ) : (
                <>
                    <Button href="/login" variant="ghost" size="sm">
                        Log in
                    </Button>
                    <Button href="/register" variant="primary" size="sm">
                        Sign up
                    </Button>
                </>
            )}
        </div>
    ) : (
        <>
            {rightSlot && <div className={styles.right}>{rightSlot}</div>}
            {actions && <div className={styles.actions}>{actions}</div>}
        </>
    );

    return (
        <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
            <Link to="/" className={styles.brandLink}>
                <img src="/logo.png" alt="" className={styles.mark} aria-hidden="true" />
                <span className={styles.brand}>Extree Stats</span>
            </Link>

            {navLinks && navLinks.length > 0 && (
                <nav className={styles.navLinks} aria-label="Primary">
                    {navLinks.map(link => (
                        <a key={link.href} href={link.href} className={styles.navLink}>
                            {link.label}
                        </a>
                    ))}
                </nav>
            )}

            <div className={styles.navRight}>
                {actionsContent}
                {navLinks && navLinks.length > 0 && (
                    <button
                        type="button"
                        className={styles.menuToggle}
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen(open => !open)}
                    >
                        {menuOpen ? <IconX /> : <MenuIcon />}
                    </button>
                )}
            </div>

            {navLinks && navLinks.length > 0 && menuOpen && (
                <>
                    <div className={styles.menuBackdrop} onClick={() => setMenuOpen(false)} aria-hidden="true" />
                    <nav className={styles.mobileMenu} aria-label="Primary">
                        {navLinks.map(link => (
                            <a
                                key={link.href}
                                href={link.href}
                                className={styles.navLink}
                                onClick={() => setMenuOpen(false)}
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>
                </>
            )}
        </header>
    );
}
