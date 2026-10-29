import { NavLink } from 'react-router-dom';
import { Dropdown } from '../../shared/ui/Dropdown';
import { ShieldIcon, UsersIcon, TicketIcon } from '../../shared/ui/Icons';
import styles from './index.module.scss';

function dropdownItemClass({ isActive }: { isActive: boolean }) {
    return `${styles.adminDropdownItem} ${isActive ? styles.active : ''}`;
}

export function AdminMenu() {
    return (
        <Dropdown
            trigger={
                <button className={styles.iconBtn} aria-label="Admin menu">
                    <ShieldIcon />
                </button>
            }
        >
            <NavLink to="/admin/users" className={dropdownItemClass}>
                <UsersIcon /> Users
            </NavLink>
            <NavLink to="/admin/tickets" className={dropdownItemClass}>
                <TicketIcon /> Tickets
            </NavLink>
            <NavLink to="/admin/audit" className={dropdownItemClass}>
                <ShieldIcon /> Audit Log
            </NavLink>
        </Dropdown>
    );
}
