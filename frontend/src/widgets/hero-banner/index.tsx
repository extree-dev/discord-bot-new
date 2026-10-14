import { ActivityIcon, BanIcon, ShieldIcon, VoiceIcon } from '../../shared/ui/icons';
import styles from './index.module.scss';

function TicketIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
            <path d="M12 7v10" strokeDasharray="2 2" />
        </svg>
    );
}

export function HeroBanner() {
    return (
        <section id="top" className={styles.hero}>
            <div className={styles.blobA} aria-hidden="true" />
            <div className={styles.blobB} aria-hidden="true" />
            <div className={styles.noise} aria-hidden="true" />
            <span className={styles.wordmark} aria-hidden="true">
                extree
            </span>
            <div className={styles.icons} aria-hidden="true">
                <span className={`${styles.icon} ${styles.iconA}`}>
                    <ShieldIcon />
                </span>
                <span className={`${styles.icon} ${styles.iconB}`}>
                    <VoiceIcon />
                </span>
                <span className={`${styles.icon} ${styles.iconC}`}>
                    <TicketIcon />
                </span>
                <span className={`${styles.icon} ${styles.iconD}`}>
                    <ActivityIcon />
                </span>
                <span className={`${styles.icon} ${styles.iconE}`}>
                    <BanIcon />
                </span>
            </div>
        </section>
    );
}
