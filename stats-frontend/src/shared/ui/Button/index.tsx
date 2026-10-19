import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './index.module.scss';

type Variant = 'primary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    fullWidth?: boolean;
    children: ReactNode;
}

// Срезанные углы (clip-path, см. index.module.scss) вместо border-radius —
// см. $cut в shared/styles/_variables.scss. Только <button>: в отличие от
// Button в основном кабинете (frontend/), здесь пока нет ни одной ссылки —
// как только появится реальный OAuth-редирект на Riot Sign-On, вариант
// href добавится по тому же паттерну, что в frontend/shared/ui/Button.
export function Button({ variant = 'primary', fullWidth, children, className, ...rest }: ButtonProps) {
    const classes = [styles.base, styles[variant], fullWidth ? styles.fullWidth : '', className]
        .filter(Boolean)
        .join(' ');

    return (
        <button className={classes} {...rest}>
            {children}
        </button>
    );
}
