import type { Showcase } from '../../entities/site-content/types';
import { Card } from '../../shared/ui/Card/Card';
import { CardAction } from '../../shared/ui/CardAction/CardAction';
import { Section } from '../../shared/ui/Section/Section';
import { TagPill } from '../../shared/ui/TagPill/TagPill';
import styles from './ShowcasesSection.module.css';

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
                    <Card key={item.title}>
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
                        <CardAction
                            url={item.url}
                            nda={item.nda}
                            upcoming={item.upcoming}
                        />
                    </Card>
                ))}
            </div>
        </Section>
    );
}