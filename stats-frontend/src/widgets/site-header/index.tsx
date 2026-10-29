import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../shared/ui/Button';
import { ProfileDropdown } from '../../shared/ui/ProfileDropdown';
import { MenuIcon, IconX } from '../../shared/ui/Icons';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './index.module.scss';

export function SiteHeader({
    rightSlot,
    actions,
    navLinks,
}: {
    rightSlot?: React.ReactNode;
    actions?: React.ReactNode;
    navLinks?: any[];
}) {
    const { status, user } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const showDefaultActions = rightSlot === undefined && actions === undefined;
    const actionsContent = showDefaultActions ? (
        <div className={styles.actions}>
            {status === 'authenticated' && user ? (
                <>
                    <Button href="/account" variant="primary" size="sm">
                        Dashboard
                    </Button>
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
        rightSlot || actions
    );

    return (
        <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
            <div className={styles.inner}>
                <Link to="/" className={styles.brand}>
                    <img src="/logo.png" alt="" className={styles.mark} />
                    <span>EXTREE</span>
                </Link>

                {navLinks && (
                    <nav className={styles.navLinks}>
                        {navLinks.map((link: any) => (
                            <a key={link.href} href={link.href} className={styles.navLink}>
                                {link.label}
                            </a>
                        ))}
                    </nav>
                )}

                <div className={styles.navRight}>
                    {actionsContent}
                    {navLinks && (
                        <button className={styles.menuToggle} onClick={() => setMenuOpen(o => !o)}>
                            {menuOpen ? <IconX /> : <MenuIcon />}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
