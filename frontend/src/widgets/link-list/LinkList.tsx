import type { SiteLink } from '../../entities/site-content/types';
import { Button } from '../../shared/ui/Button';
import { LinkIcon, StaticLinkIcon } from '../../shared/ui/icons';
import styles from './LinkList.module.css';

interface LinkListProps {
    links: SiteLink[];
}

// Первая ссылка с URL оформляется как основной CTA (градиентная заливка),
// остальные кликабельные — обычной кнопкой, чтобы не спорили за внимание.
// Ссылки без URL (например "Discord: .extree") рендерятся как простой
// текст-строка, а не кнопка — у них по смыслу нет действия по клику.
export function LinkList({ links }: LinkListProps) {
    let primaryUsed = false;

    return (
        <div className={styles.links}>
            {links.map((link, index) => {
                if (!link.url) {
                    return (
                        <Button key={index} variant="static" icon={<StaticLinkIcon />} fullWidth disabled>
                            {link.label}
                        </Button>
                    );
                }
                const isPrimary = !primaryUsed;
                primaryUsed = true;
                return (
                    <Button
                        key={index}
                        href={link.url}
                        variant={isPrimary ? 'primary' : 'default'}
                        icon={<LinkIcon />}
                        arrow
                        fullWidth
                    >
                        {link.label}
                    </Button>
                );
            })}
        </div>
    );
}
