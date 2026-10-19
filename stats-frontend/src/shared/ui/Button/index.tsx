import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './index.module.scss';

type Variant = 'primary' | 'ghost';

interface CommonProps {
    variant?: Variant;
    fullWidth?: boolean;
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
    fullWidth,
    children,
    className,
    href,
    ...rest
}: ButtonProps | LinkProps) {
    const classes = [styles.base, styles[variant], fullWidth ? styles.fullWidth : '', className]
        .filter(Boolean)
        .join(' ');

    if (href !== undefined) {
        return (
            <a className={classes} href={href} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
                {children}
            </a>
        );
    }

    return (
        <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
            {children}
        </button>
    );
}
