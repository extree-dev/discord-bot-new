import { Link } from 'react-router-dom';
import styles from './index.module.scss';

interface BackButtonProps {
    to: string;
    label?: string;
}

export function BackButton({ to, label = 'Back' }: BackButtonProps) {
    return (
        <Link to={to} className={styles.backBtn}>
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {label}
        </Link>
    );
}
