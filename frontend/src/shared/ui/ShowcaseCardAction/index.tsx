import { ArrowUpRightIcon } from '../icons';
import styles from './index.module.scss';

interface ShowcaseCardActionProps {
    url?: string;
    nda?: boolean;
    upcoming?: boolean;
    /** Текст ссылки; по умолчанию «View website». */
    label?: string;
}

export function ShowcaseCardAction({ url, nda, upcoming, label = 'View website' }: ShowcaseCardActionProps) {
    if (nda) {
        return <span className={styles.blocked}>Non-disclosure agreement-bound</span>;
    }
    if (upcoming) {
        return <span className={styles.blocked}>To be published</span>;
    }
    if (!url) return null;

    return (
        <a className={styles.link} href={url} target="_blank" rel="noreferrer">
            <span>{label}</span>
            <ArrowUpRightIcon />
        </a>
    );
}
