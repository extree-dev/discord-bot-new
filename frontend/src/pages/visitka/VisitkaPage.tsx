import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { getSiteContent } from '../../entities/site-content/api';
import type { SiteContent } from '../../entities/site-content/types';
import { detectPlatform } from '../../shared/lib/platform';
import type { Platform } from '../../shared/lib/platform';
import { BrandMark } from '../../shared/ui/BrandMark';
import {
    ActivityIcon,
    BanIcon,
    DiscordIcon,
    FlagGbIcon,
    FlagRuIcon,
    GithubIcon,
    GlobeIcon,
    InstagramIcon,
    ShieldIcon,
    TelegramIcon,
    TwitterIcon,
    VoiceIcon,
    YoutubeIcon,
} from '../../shared/ui/icons';
import styles from './VisitkaPage.module.css';

const PLATFORM_ICON: Record<Platform, () => ReactElement> = {
    discord: DiscordIcon,
    telegram: TelegramIcon,
    instagram: InstagramIcon,
    twitter: TwitterIcon,
    youtube: YoutubeIcon,
    github: GithubIcon,
    generic: GlobeIcon,
};

function TicketIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
            <path d="M12 7v10" strokeDasharray="2 2" />
        </svg>
    );
}

const CONTACT_EMAIL = 'support@extree.tech';

interface Language {
    Flag: () => ReactElement;
    code: string;
    label: string;
}

// Пример — настоящий список языков владелец сайта пришлёт отдельно.
// Флаги — свои SVG (FlagRuIcon/FlagGbIcon), не emoji: Unicode
// regional-indicator эмодзи не рендерятся как флаги на Windows (показывают
// буквы кода страны вместо картинки).
const LANGUAGES: Language[] = [
    { Flag: FlagRuIcon, code: 'RU', label: 'Russian' },
    { Flag: FlagGbIcon, code: 'EN', label: 'English' },
];

// Публичная страница продукта (extree.tech "/"). Структура и язык —
// под референс (frdg.work): герой — чисто декоративный баннер (вотермарк
// + иконки), герой и контент ниже склеены в одну панель без шва,
// повёрнутые вертикальные подписи секций, двухпанельный контактный блок.
export function VisitkaPage() {
    const [content, setContent] = useState<SiteContent | null>(null);

    useEffect(() => {
        getSiteContent()
            .then(setContent)
            .catch(() => setContent(null));
    }, []);

    useEffect(() => {
        const prevLang = document.documentElement.lang;
        document.documentElement.lang = 'en';
        return () => {
            document.documentElement.lang = prevLang;
        };
    }, []);

    if (content) document.title = content.name;

    if (!content) {
        return <div className={styles.page} />;
    }

    return (
        <div className={styles.page}>
            <nav className={styles.nav}>
                <div className={styles.navLinks}>
                    <a href="#about">About me</a>
                    <a href="#contact">Contact</a>
                </div>
            </nav>

            <main className={styles.main}>
                <div className={styles.contentPanel}>
                    <section id="top" className={styles.hero}>
                        <div className={styles.heroBlobA} aria-hidden="true" />
                        <div className={styles.heroBlobB} aria-hidden="true" />
                        <div className={styles.heroNoise} aria-hidden="true" />
                        <span className={styles.heroWordmark} aria-hidden="true">
                            extree
                        </span>
                        <div className={styles.heroIcons} aria-hidden="true">
                            <span className={`${styles.heroIcon} ${styles.heroIconA}`}>
                                <ShieldIcon />
                            </span>
                            <span className={`${styles.heroIcon} ${styles.heroIconB}`}>
                                <VoiceIcon />
                            </span>
                            <span className={`${styles.heroIcon} ${styles.heroIconC}`}>
                                <TicketIcon />
                            </span>
                            <span className={`${styles.heroIcon} ${styles.heroIconD}`}>
                                <ActivityIcon />
                            </span>
                            <span className={`${styles.heroIcon} ${styles.heroIconE}`}>
                                <BanIcon />
                            </span>
                        </div>
                    </section>

                    <section id="about" className={styles.section}>
                        <span className={styles.sectionLabel}>about me</span>
                        <div className={styles.sectionBody}>
                            <div className={styles.aboutHeader}>
                                <h1 className={styles.aboutName}>{content.name}</h1>
                                {content.role && <span className={styles.aboutRole}>{content.role}</span>}
                            </div>
                            {content.bio && <p className={styles.bio}>{content.bio}</p>}
                            <span className={styles.languageHeading}>talk to me in</span>
                            <div className={styles.languageRow}>
                                {LANGUAGES.map(lang => (
                                    <span key={lang.code} className={styles.languagePill}>
                                        <span className={styles.languageFlag} aria-hidden="true">
                                            <lang.Flag />
                                        </span>
                                        {lang.code}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>

                <section id="contact" className={styles.section}>
                    <div className={styles.sectionBody}>
                        <div className={styles.contactSide}>
                            <span className={styles.contactSideLabel}>reach out via email</span>
                            <a className={styles.emailPill} href={`mailto:${CONTACT_EMAIL}`}>
                                {CONTACT_EMAIL}
                            </a>
                        </div>
                    </div>
                    <span className={styles.sectionLabel}>contact</span>
                </section>
            </main>

            <footer className={styles.footer}>
                <a className={styles.footerBrand} href="#top">
                    <BrandMark className={styles.footerBadge} />
                    <span>{content.name}</span>
                </a>
                <div className={styles.footerLinks}>
                    <a href="#about">About me</a>
                    <a href="#contact">Contact</a>
                </div>
                {content.links.length > 0 && (
                    <div className={styles.footerSocial}>
                        {content.links
                            .filter(link => link.url)
                            .map(link => {
                                const Icon = PLATFORM_ICON[detectPlatform(link)];
                                return (
                                    <a
                                        key={link.label}
                                        className={styles.footerSocialIcon}
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
                <span className={styles.footerCopy}>© {content.name}</span>
            </footer>
        </div>
    );
}
