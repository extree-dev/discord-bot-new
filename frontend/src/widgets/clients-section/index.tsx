import type { Client } from '../../entities/site-content/types';
import { Section } from '../../shared/ui/Section';
import styles from './index.module.scss';

interface ClientsSectionProps {
    items: Client[];
}

export function ClientsSection({ items }: ClientsSectionProps) {
    if (items.length === 0) return null;

    return (
        <Section id="clients" label="clients">
            <ul className={styles.grid}>
                {items.map(client => (
                    <li key={client.name} className={styles.row}>
                        <span className={styles.name}>{client.name}</span>
                        <span className={styles.period}>{client.period}</span>
                    </li>
                ))}
            </ul>
        </Section>
    );
}
