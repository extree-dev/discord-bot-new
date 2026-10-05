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

// Классический вид "линк-ин-био" (Linktree и подобные): все ссылки —
// одинаковые пилюли-кнопки без деления на "главную" и остальные, иконка
// слева подбирается по платформе (детект по домену/тексту — см.
// platform.ts), а не одна общая иконка на всё. Ссылка без URL (например
// "Discord: .extree" — просто контакт, не переход) рендерится тем же
// пилюля-стилем, но не кликабельна.
export function LinkList({ links }: LinkListProps) {
    return (
        <div className={styles.links}>
            {links.map((link, index) => {
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
    );
}
