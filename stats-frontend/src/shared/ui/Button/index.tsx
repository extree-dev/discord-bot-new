import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './index.module.scss';

type Variant = 'primary' | 'secondary' | 'ghost' | 'flat';
type Size = 'md' | 'sm';

interface CommonProps {
    variant?: Variant;
    size?: Size;
    fullWidth?: boolean;
    // Спиннер вместо содержимого + aria-busy + disabled. Только для
    // <button> — ссылка (href) не умеет быть "занятой" в том же смысле
    // (это обычно редирект, который просто уводит со страницы).
    loading?: boolean;
    children: ReactNode;
}

type ButtonProps = CommonProps &
    ButtonHTMLAttributes<HTMLButtonElement> & {
        href?: undefined;
    };

type LinkProps = CommonProps &
    AnchorHTMLAttributes<HTMLAnchorElement> & {
        href: string;
    };

// Кнопка-ссылка (OAuth-редирект на /auth/riot/login) или обычная <button> —
// один и тот же паттерн, что в frontend/shared/ui/Button: разная семантика
// тега, одна визуальная оболочка, вместо двух почти одинаковых компонентов.
export function Button({
    variant = 'primary',
    size = 'md',
    fullWidth,
    loading,
    children,
    className,
    href,
    ...rest
}: ButtonProps | LinkProps) {
    const classes = [
        styles.base,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : '',
        loading ? styles.loading : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    if (href !== undefined) {
        return (
            <a className={classes} href={href} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
                {children}
            </a>
        );
    }

    const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;

    return (
        <button
            className={classes}
            disabled={loading || buttonRest.disabled}
            aria-busy={loading || undefined}
            {...buttonRest}
        >
            {loading && <span className={styles.spinner} aria-hidden="true" />}
            {children}
        </button>
    );
}
