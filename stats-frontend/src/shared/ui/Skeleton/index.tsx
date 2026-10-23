import styles from './index.module.scss';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    radius?: string | number;
    className?: string;
}

// Generic skeleton-block для loading-states. Не знает про бизнес-логику.
// Анимация отключается через `prefers-reduced-motion` (см. .module.scss).
export function Skeleton({ width = '100%', height = 16, radius = 6, className }: SkeletonProps) {
    return (
        <span
            className={`${styles.skeleton} ${className ?? ''}`}
            style={{ width, height, borderRadius: radius }}
            aria-hidden="true"
        />
    );
}
