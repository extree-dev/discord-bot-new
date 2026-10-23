import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../shared/ui/Button';
import { ProfileDropdown } from '../../shared/ui/ProfileDropdown';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './index.module.scss';

// Кнопка ⌘K — открывает CommandPalette. Слушает keydown на уровне документа
// через хук в CommandPalette, поэтому здесь достаточно dispatch-нуть event.
function CmdKButton() {
    function onClick() {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    }
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
                color: 'var(--text-faint)',
                cursor: 'pointer',
                fontFamily: 'inherit',
            }}
            aria-label="Open command palette"
        >
            ⌘K
        </button>
    );
}

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
                    actions && <div className={styles.actions}>{actions}</div>
                )}
            </div>
        </header>
    );
}
