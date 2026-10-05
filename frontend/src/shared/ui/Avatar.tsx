import styles from './Avatar.module.css';

interface AvatarProps {
    src: string;
    alt: string;
    size?: 'large' | 'small';
}

export function Avatar({ src, alt, size = 'large' }: AvatarProps) {
    const dimension = size === 'large' ? 112 : 56;
    return (
        <img
            className={size === 'large' ? styles.large : styles.small}
            src={src}
            alt={alt}
            width={dimension}
            height={dimension}
        />
    );
}
