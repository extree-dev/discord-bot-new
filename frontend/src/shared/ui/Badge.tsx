import type { ReactNode } from 'react';
import styles from './Badge.module.css';

type BadgeVariant = 'neutral' | 'accent' | 'danger' | 'success';

interface BadgeProps {
    children: ReactNode;
    variant?: BadgeVariant;
}

const CLASS_BY_VARIANT: Record<BadgeVariant, string> = {
    neutral: styles.neutral,
    accent: styles.accent,
    danger: styles.danger,
    success: styles.success,
};

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
    return <span className={`${styles.badge} ${CLASS_BY_VARIANT[variant]}`}>{children}</span>;
}
