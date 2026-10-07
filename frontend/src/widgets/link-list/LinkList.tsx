import type { ReactElement } from 'react';
import type { SiteLink } from '../../entities/site-content/types';
import {
    DiscordIcon,
    GithubIcon,
    GlobeIcon,
    InstagramIcon,
    TelegramIcon,
    TwitterIcon,
    YoutubeIcon,
} from '../../shared/ui/icons';
import { detectPlatform, type Platform } from './platform';
import styles from './LinkList.module.css';

interface LinkListProps {
    links: SiteLink[];
}

const PLATFORM_ICON: Record<Platform, () => ReactElement> = {
    discord: DiscordIcon,
    telegram: TelegramIcon,
    instagram: InstagramIcon,
    twitter: TwitterIcon,
    youtube: YoutubeIcon,
    github: GithubIcon,
    generic: GlobeIcon,
};

// Настоящий Linktree (в отличие от нашей прежней версии, где вообще всё
// было одинаковыми пилюлями) разносит ссылки на два ряда: мелкие
// кружки-иконки для соцсетей профиля и крупные пилюли-кнопки для
// отдельных "смотри сюда" ссылок (сайт, последнее видео и т.д.) — тут
// используется та же эвристика: распознанная платформа (не generic) +
// реальный url = соцсеть-кружок, остальное (ссылка без платформы вроде
// "Extree — бот модерации", и записи без url вроде "Discord: .extree" —
// просто контакт, не переход) остаётся пилюлей с подписью.
export function LinkList({ links }: LinkListProps) {
    const socialLinks = links.filter(link => link.url && detectPlatform(link) !== 'generic');
    const pillLinks = links.filter(link => !(link.url && detectPlatform(link) !== 'generic'));

    return (
        <div className={styles.wrapper}>
            {socialLinks.length > 0 && (
                <div className={styles.socialRow}>
                    {socialLinks.map((link, index) => {
                        const Icon = PLATFORM_ICON[detectPlatform(link)];
                        return (
                            <a
                                key={index}
                                className={styles.socialIcon}
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                title={link.label}
                            >
                                <Icon />
                            </a>
                        );
                    })}
                </div>
            )}

            {pillLinks.length > 0 && (
                <div className={styles.links}>
                    {pillLinks.map((link, index) => {
                        const Icon = PLATFORM_ICON[detectPlatform(link)];
                        const content = (
                            <>
                                <span className={styles.icon}>
                                    <Icon />
                                </span>
                                <span className={styles.label}>{link.label}</span>
                            </>
                        );
                        return link.url ? (
                            <a key={index} className={styles.link} href={link.url} target="_blank" rel="noreferrer">
                                {content}
                            </a>
                        ) : (
                            <span key={index} className={`${styles.link} ${styles.linkStatic}`}>
                                {content}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
