import type { ButtonHTMLAttributes, ReactNode } from 'react'; // <-- Добавь ReactNode
import styles from './index.module.scss';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'danger' | 'active';
    children: ReactNode; // <-- ДОБАВЬ ЭТУ СТРОКУ
}

export function IconButton({ variant = 'default', className, children, ...rest }: IconButtonProps) {
    return (
        <button className={`${styles.btn} ${styles[variant]} ${className ?? ''}`} {...rest}>
            {children}
        </button>
    );
}