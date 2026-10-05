import { useEffect, useState } from 'react';
import { getSiteContent } from '../../entities/site-content/api';
import type { SiteContent } from '../../entities/site-content/types';
import { Avatar } from '../../shared/ui/Avatar';
import { Card } from '../../shared/ui/Card';
import { AppShell } from '../../widgets/app-shell/AppShell';
import { LinkList } from '../../widgets/link-list/LinkList';
import styles from './VisitkaPage.module.css';

export function VisitkaPage() {
    const [content, setContent] = useState<SiteContent | null>(null);

    useEffect(() => {
        getSiteContent()
            .then(setContent)
            .catch(() => setContent(null));
    }, []);

    if (content) document.title = content.name;

    return (
        <AppShell>
            {content && (
                <Card>
                    <Avatar src="/avatar.jpg" alt={content.name} size="large" />
                    <h1>{content.name}</h1>
                    {content.role && <p className={styles.role}>{content.role}</p>}
                    <p className={styles.bio}>{content.bio}</p>
                    <LinkList links={content.links} />
                    <footer className={styles.footer}>© {content.name}</footer>
                </Card>
            )}
        </AppShell>
    );
}
