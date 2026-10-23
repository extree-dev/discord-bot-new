import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../shared/ui/Button';
import { ProfileDropdown } from '../../shared/ui/ProfileDropdown';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './index.module.scss';

interface SiteHeaderProps {
    rightSlot?: ReactNode;
    actions?: ReactNode;
}

// SRP: только хедер. Если передан явный rightSlot/actions — рендерим их
// (как раньше). Если НЕ переданы — рендерим дефолтные по статусу auth:
// - authenticated → Dashboard + ProfileDropdown
// - anonymous → Log in / Sign up
export function SiteHeader({ rightSlot, actions }: SiteHeaderProps) {
    const { status, user } = useAuth();

    const showDefaultActions = rightSlot === undefined && actions === undefined;

    return (
        <header className={styles.header}>
            <Link to="/" className={styles.brandLink}>
                <img src="/logo.png" alt="" className={styles.mark} aria-hidden="true" />
                <span className={styles.brand}>Extree Stats</span>
            </Link>
            <div className={styles.navRight}>
                {rightSlot && <div className={styles.right}>{rightSlot}</div>}
                {showDefaultActions ? (
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
                    actions && <div className={styles.actions}>{actions}</div>
                )}
            </div>
        </header>
    );
}
