import type { ReactNode } from 'react';
import styles from './index.module.scss';

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
}

// Переиспользуемый placeholder — для /admin/tickets (Select a ticket),
// для пустого списка тикетов, для "no results" поиска, для 404.
// Не знает ни про роутер, ни про бизнес-логику (SRP).
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className={styles.root}>
            {icon && <div className={styles.iconWrap}>{icon}</div>}
            <h3 className={styles.title}>{title}</h3>
            {description && <p className={styles.description}>{description}</p>}
            {action && <div className={styles.action}>{action}</div>}
        </div>
    );
}
