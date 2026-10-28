import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldIcon, UsersIcon, TicketIcon } from '../../shared/ui/Icons';
import styles from './index.module.scss';

function dropdownItemClass({ isActive }: { isActive: boolean }) {
    return `${styles.adminDropdownItem} ${isActive ? styles.active : ''}`;
}

// Раньше Users/Tickets/Audit Log лежали прямо в топбаре между обычными
// пунктами меню — работало, но захламляло навигацию для админов. Теперь
// это отдельное выпадающее меню за иконкой щита, открытое только тем, кому
// можно: не рендерится вовсе, если user.isAdmin === false (см. вызывающий
// код в index.tsx) — это не декоративная деталь, а единственное место,
// откуда вообще достижимы ссылки на admin-страницы из шапки.
export function AdminMenu() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function onClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', onClickOutside);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div className={styles.adminMenu} ref={ref}>
            <button
                type="button"
                className={`${styles.iconBtn} ${open ? styles.iconBtnActive : ''}`}
                onClick={() => setOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Admin menu"
                title="Admin menu"
            >
                <ShieldIcon />
            </button>
            {open && (
                <nav className={styles.adminDropdown} aria-label="Admin">
                    <NavLink to="/admin/users" className={dropdownItemClass} onClick={() => setOpen(false)}>
                        <UsersIcon />
                        Users
                    </NavLink>
                    <NavLink to="/admin/tickets" className={dropdownItemClass} onClick={() => setOpen(false)}>
                        <TicketIcon />
                        Tickets
                    </NavLink>
                    <NavLink to="/admin/audit" className={dropdownItemClass} onClick={() => setOpen(false)}>
                        <ShieldIcon />
                        Audit Log
                    </NavLink>
                </nav>
            )}
        </div>
    );
}
