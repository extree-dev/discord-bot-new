import styles from './Avatar.module.css';

interface AvatarProps {
    src: string;
    alt: string;
    size?: 'hero' | 'large' | 'small';
}

const DIMENSIONS: Record<NonNullable<AvatarProps['size']>, number> = {
    hero: 180,
    large: 120,
    small: 56,
};

const CLASS_NAMES: Record<NonNullable<AvatarProps['size']>, string> = {
    hero: styles.hero,
    large: styles.large,
    small: styles.small,
};

export function Avatar({ src, alt, size = 'large' }: AvatarProps) {
    return <img className={CLASS_NAMES[size]} src={src} alt={alt} width={DIMENSIONS[size]} height={DIMENSIONS[size]} />;
}
