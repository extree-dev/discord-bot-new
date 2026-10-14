import type { Tool } from '../../entities/site-content/types';
import { Card } from '../../shared/ui/Card/Card';
import { CardAction } from '../../shared/ui/CardAction/CardAction';
import { Section } from '../../shared/ui/Section/Section';
import { TagPill } from '../../shared/ui/TagPill/TagPill';
import styles from './ToolsSection.module.css';

interface ToolsSectionProps {
    items: Tool[];
}

export function ToolsSection({ items }: ToolsSectionProps) {
    if (items.length === 0) return null;

    return (
        <Section id="tools" label="tools">
            <div className={styles.list}>
                {items.map(tool => (
                    <Card key={tool.title}>
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
                        <CardAction
                            url={tool.url}
                            nda={tool.nda}
                            upcoming={tool.upcoming}
                        />
                    </Card>
                ))}
            </div>
        </Section>
    );
}