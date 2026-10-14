import type { Showcase } from '../../entities/site-content/types';
import { ShowcaseCard } from '../../shared/ui/ShowcaseCard';
import { ShowcaseCardAction } from '../../shared/ui/ShowcaseCardAction';
import { Section } from '../../shared/ui/Section';
import { TagPill } from '../../shared/ui/TagPill';
import styles from './index.module.scss';

interface ShowcasesSectionProps {
    id: string;
    label: string;
    items: Showcase[];
}

export function ShowcasesSection({ id, label, items }: ShowcasesSectionProps) {
    if (items.length === 0) return null;

    return (
        <Section id={id} label={label}>
            <div className={styles.list}>
                {items.map(item => (
                    <ShowcaseCard key={item.title}>
                        <header className={styles.head}>
                            <h3 className={styles.title}>{item.title}</h3>
                            {item.tags.length > 0 && (
                                <div className={styles.tags}>
                                    {item.tags.map(tag => (
                                        <TagPill key={tag}>{tag}</TagPill>
                                    ))}
                                </div>
                            )}
                        </header>
                        <p className={styles.description}>{item.description}</p>
                        <ShowcaseCardAction url={item.url} nda={item.nda} upcoming={item.upcoming} />
                    </ShowcaseCard>
                ))}
            </div>
        </Section>
    );
}
