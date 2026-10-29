import { Link } from 'react-router-dom';
import { Dropdown } from '../Dropdown';
import { TicketIcon, SettingsIcon, ShieldIcon, PowerIcon, UsersIcon } from './icons';
import styles from './index.module.scss';

interface ProfileDropdownProps {
    email: string;
    isAdmin?: boolean;
}

export function ProfileDropdown({ email, isAdmin }: ProfileDropdownProps) {
    const initial = email ? email[0].toUpperCase() : '?';
    const handleSignOut = () => {
        window.location.href = '/auth/logout';
    };

    return (
        <Dropdown trigger={<button className={styles.avatarBtn}>{initial}</button>}>
            <div className={styles.menuHeader}>
                <span className={styles.brandName}>Extree Stats</span>
            </div>
            <div className={styles.menuList}>
                <Link to="/account/settings" className={styles.menuItem}>
                    <SettingsIcon /> Account Settings
                </Link>
                <Link to="/support" className={styles.menuItem}>
                    <TicketIcon /> Support
                </Link>
                {isAdmin && (
                    <>
                        <Link to="/admin/tickets" className={styles.menuItem}>
                            <ShieldIcon /> Admin Tickets
                        </Link>
                        <Link to="/admin/users" className={styles.menuItem}>
                            <UsersIcon /> Manage Users
                        </Link>
                        <Link to="/admin/audit" className={styles.menuItem}>
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
        </Dropdown>
    );
}
