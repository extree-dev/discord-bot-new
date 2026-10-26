import type { Tool } from '../../entities/site-content/types';
import { ShowcaseCard } from '../../shared/ui/ShowcaseCard';
import { ShowcaseCardAction } from '../../shared/ui/ShowcaseCardAction';
import { Section } from '../../shared/ui/Section';
import { TagPill } from '../../shared/ui/TagPill';
import styles from './index.module.scss';

interface ToolsSectionProps {
    items: Tool[];
}

export function ToolsSection({ items }: ToolsSectionProps) {
    if (items.length === 0) return null;

    return (
        <Section id="tools" label="tools">
            <div className={styles.list}>
                {items.map(tool => (
                    <ShowcaseCard key={tool.title}>
                        <header className={styles.head}>
                            <h3 className={styles.title}>{tool.title}</h3>
                            {tool.tags.length > 0 && (
                                <div className={styles.tags}>
                                    {tool.tags.map(tag => (
                                        <TagPill key={tag}>{tag}</TagPill>
                                    ))}
                                </div>
                            )}
                        </header>
                        <p className={styles.description}>{tool.description}</p>
                        <ShowcaseCardAction url={tool.url} nda={tool.nda} upcoming={tool.upcoming} />
                    </ShowcaseCard>
                ))}
            </div>
        </Section>
    );
}
