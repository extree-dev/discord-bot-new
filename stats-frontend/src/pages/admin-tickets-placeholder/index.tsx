import { Link } from 'react-router-dom';
import styles from './index.module.scss';

export function AdminTicketsPlaceholder() {
    return (
        <div className={styles.placeholder}>
            <div className={styles.iconWrap} aria-hidden="true">
                <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            </div>
            <h2 className={styles.title}>Select a ticket</h2>
            <p className={styles.lead}>
                Pick a ticket from the list on the left to view the conversation and reply. On narrow screens, use{' '}
                <Link to="/admin/tickets" className={styles.link}>
                    the list
                </Link>{' '}
                to browse.
            </p>
        </div>
    );
}
