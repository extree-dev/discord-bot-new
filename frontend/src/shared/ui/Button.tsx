import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'default' | 'primary' | 'static' | 'ghost';

interface CommonProps {
    variant?: Variant;
    icon?: ReactNode;
    arrow?: boolean;
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

function variantClass(variant: Variant): string {
    if (variant === 'primary') return `${styles.base} ${styles.primary}`;
    if (variant === 'static') return `${styles.base} ${styles.static}`;
    if (variant === 'ghost') return `${styles.base} ${styles.ghost}`;
    return styles.base;
}

// Кнопка-ссылка (навигация, OAuth-логин, внешние ссылки на визитке) или
// обычная <button> (сабмит формы) — одна и та же визуальная оболочка,
// различается только тегом, чтобы не плодить два почти одинаковых
// компонента ради семантики. variant: 'default' — обычная бордер-кнопка
// (вторичная ссылка в LinkList), 'primary' — градиент (главный CTA),
// 'static' — не кликабельна (disabled), 'ghost' — минималистичная
// центрированная (логин/логаут/добавить-удалить строку в форме).
export function Button({
    variant = 'default',
    icon,
    arrow,
    fullWidth,
    children,
    href,
    ...rest
}: ButtonProps | LinkProps) {
    const className = `${variantClass(variant)}${fullWidth ? ` ${styles.fullWidth}` : ''}`;

    if (href !== undefined) {
        return (
            <a className={className} href={href} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
                {icon && <span className={styles.icon}>{icon}</span>}
                <span className={styles.label}>{children}</span>
                {arrow && <span className={styles.arrow}>→</span>}
            </a>
        );
    }

    return (
        <button className={className} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
            {icon && <span className={styles.icon}>{icon}</span>}
            <span className={styles.label}>{children}</span>
            {arrow && <span className={styles.arrow}>→</span>}
        </button>
    );
}
