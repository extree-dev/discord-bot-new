import { useState, useRef, useEffect, type ReactNode } from 'react';
import styles from './index.module.scss';

interface DropdownProps {
    trigger: ReactNode;
    children: ReactNode;
    align?: 'left' | 'right';
}

export function Dropdown({ trigger, children, align = 'right' }: DropdownProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [open]);

    return (
        <div className={styles.container} ref={containerRef}>
            <div onClick={() => setOpen(o => !o)} className={styles.trigger}>
                {trigger}
            </div>
            {open && (
                <div className={`${styles.menu} ${align === 'left' ? styles.menuLeft : styles.menuRight}`}>
                    {children}
                </div>
            )}
        </div>
    );
}
