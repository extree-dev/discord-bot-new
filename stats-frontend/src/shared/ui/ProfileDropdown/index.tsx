import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TicketIcon, SettingsIcon, ShieldIcon, PowerIcon, UsersIcon } from './icons';
import styles from './index.v2.module.scss';

interface ProfileDropdownProps {
    email: string;
    isAdmin?: boolean;
}

export function ProfileDropdown({ email, isAdmin }: ProfileDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSignOut = () => {
        window.location.href = '/auth/logout';
    };

    const initial = email ? email[0].toUpperCase() : '?';

    return (
        <div className={styles.container} ref={menuRef}>
            <button className={`${styles.avatarBtn} ${isOpen ? styles.active : ''}`} onClick={() => setIsOpen(!isOpen)}>
                {initial}
            </button>

            {isOpen && (
                <div className={styles.menu}>
                    <div className={styles.menuHeader}>
                        <span className={styles.brandName}>Extree Stats</span>
                    </div>

                    <div className={styles.menuList}>
                        <Link to="/account/settings" className={styles.menuItem} onClick={() => setIsOpen(false)}>
                            <SettingsIcon /> Account Settings
                        </Link>

                        <Link to="/support" className={styles.menuItem} onClick={() => setIsOpen(false)}>
                            <TicketIcon /> Support
                        </Link>

                        {isAdmin && (
                            <>
                                <Link to="/admin/tickets" className={styles.menuItem} onClick={() => setIsOpen(false)}>
                                    <ShieldIcon /> Admin Tickets
                                </Link>
                                <Link to="/admin/users" className={styles.menuItem} onClick={() => setIsOpen(false)}>
                                    <UsersIcon /> Manage Users
                                </Link>
                                <Link to="/admin/audit" className={styles.menuItem} onClick={() => setIsOpen(false)}>
                                    <ShieldIcon /> Audit log
                                </Link>
                            </>
                        )}
                    </div>

                    <div className={styles.divider} />

                    <div className={styles.menuList}>
                        <button onClick={handleSignOut} className={styles.menuItem}>
                            <PowerIcon /> Logout
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
