import type { ReactElement } from 'react';
import type { SiteLink } from '../../entities/site-content/types';
import { detectPlatform } from '../../shared/lib/platform';
import type { Platform } from '../../shared/lib/platform';
import { BrandMark } from '../../shared/ui/BrandMark';
import {
    DiscordIcon,
    GithubIcon,
    GlobeIcon,
    InstagramIcon,
    TelegramIcon,
    TwitterIcon,
    YoutubeIcon,
} from '../../shared/ui/icons';
import styles from './SiteFooter.module.css';

const PLATFORM_ICON: Record<Platform, () => ReactElement> = {
    discord: DiscordIcon,
    telegram: TelegramIcon,
    instagram: InstagramIcon,
    twitter: TwitterIcon,
    youtube: YoutubeIcon,
    github: GithubIcon,
    generic: GlobeIcon,
};

interface SiteFooterProps {
    name: string;
    socialLinks: SiteLink[];
}

// Футер визитки. socialLinks приходят уже отфильтрованными
// (см. selectSocialLinks в entities/site-content/model).
export function SiteFooter({ name, socialLinks }: SiteFooterProps) {
    return (
        <footer className={styles.footer}>
            <a className={styles.brand} href="#top">
                <BrandMark className={styles.badge} />
                <span>{name}</span>
            </a>
            <div className={styles.links}>
                <a href="#about">About me</a>
                <a href="#contact">Contact</a>
            </div>
            {socialLinks.length > 0 && (
                <div className={styles.social}>
                    {socialLinks.map(link => {
                        const Icon = PLATFORM_ICON[detectPlatform(link)];
                        return (
                            <a
                                key={link.url}
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
            <span className={styles.copy}>© {name}</span>
        </footer>
    );
}
