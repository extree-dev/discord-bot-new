import styles from './Avatar.module.css';

interface AvatarProps {
    src: string;
    alt: string;
    size?: 'large' | 'small' | 'tiny';
}

const DIMENSIONS = { large: 120, small: 56, tiny: 28 };
const CLASS_BY_SIZE = { large: styles.large, small: styles.small, tiny: styles.tiny };

export function Avatar({ src, alt, size = 'large' }: AvatarProps) {
    return (
        <img className={CLASS_BY_SIZE[size]} src={src} alt={alt} width={DIMENSIONS[size]} height={DIMENSIONS[size]} />
    );
}
