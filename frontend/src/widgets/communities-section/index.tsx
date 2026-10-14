import type { Community } from '../../entities/site-content/types';
import { ShowcaseCard } from '../../shared/ui/ShowcaseCard';
import { ShowcaseCardAction } from '../../shared/ui/ShowcaseCardAction';
import { Section } from '../../shared/ui/Section';
import { StatPair } from '../../shared/ui/StatPair';
import styles from './index.module.scss';

interface CommunitiesSectionProps {
    items: Community[];
}

export function CommunitiesSection({ items }: CommunitiesSectionProps) {
    if (items.length === 0) return null;

    return (
        <Section id="communities" label="communities">
            <div className={styles.list}>
                {items.map(community => (
                    <ShowcaseCard key={community.name}>
                        <StatPair online={community.online} members={community.members} />
                        <h3 className={styles.title}>{community.title}</h3>
                        <ul className={styles.responsibilities}>
                            {community.responsibilities.map(item => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                        <ShowcaseCardAction url={community.url} label="Join server" />
                    </ShowcaseCard>
                ))}
            </div>
        </Section>
    );
}
