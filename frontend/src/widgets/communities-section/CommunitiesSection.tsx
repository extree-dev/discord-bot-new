import type { Community } from '../../entities/site-content/types';
import { Card } from '../../shared/ui/Card/Card';
import { CardAction } from '../../shared/ui/CardAction/CardAction';
import { Section } from '../../shared/ui/Section/Section';
import { StatPair } from '../../shared/ui/StatPair/StatPair';
import styles from './CommunitiesSection.module.css';

interface CommunitiesSectionProps {
    items: Community[];
}

export function CommunitiesSection({ items }: CommunitiesSectionProps) {
    if (items.length === 0) return null;

    return (
        <Section id="communities" label="communities">
            <div className={styles.list}>
                {items.map(community => (
                    <Card key={community.name}>
                        <StatPair online={community.online} members={community.members} />
                        <h3 className={styles.title}>{community.title}</h3>
                        <ul className={styles.responsibilities}>
                            {community.responsibilities.map(item => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                        <CardAction url={community.url} label="Join server" />
                    </Card>
                ))}
            </div>
        </Section>
    );
}
