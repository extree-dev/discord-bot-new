import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { getSiteContent } from '../../entities/site-content/api';
import type { SiteContent } from '../../entities/site-content/types';
import { LinkList } from '../../widgets/link-list/LinkList';
import { BrandMark } from '../../shared/ui/BrandMark';
import { ActivityIcon, BanIcon, GridIcon, ShieldIcon, VoiceIcon } from '../../shared/ui/icons';
import styles from './VisitkaPage.module.css';

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

type FeatureTag = 'Безопасность' | 'Поддержка' | 'Комьюнити';

interface Feature {
    icon: () => ReactElement;
    title: string;
    description: string;
    tag: FeatureTag;
}

const FEATURES: Feature[] = [
    {
        icon: ShieldIcon,
        title: 'Безопасность',
        description: 'Anti-nuke, raid shield, automod против спама/ссылок/капса, картиночная капча при входе.',
        tag: 'Безопасность',
    },
    {
        icon: BanIcon,
        title: 'Модерация',
        description: 'Варны с угасанием по давности, кастомный мут, временный бан, единый журнал дел по участнику.',
        tag: 'Безопасность',
    },
    {
        icon: TicketIcon,
        title: 'Тикеты поддержки',
        description:
            'Жалоба на игрока или прямо по сообщению, апелляция на мут одной кнопкой, автоэскалация без ответа.',
        tag: 'Поддержка',
    },
    {
        icon: GridIcon,
        title: 'Панель администратора',
        description: 'Управление сервером и точечные наказания без единой слэш-команды.',
        tag: 'Поддержка',
    },
    {
        icon: VoiceIcon,
        title: 'Голосовые комнаты',
        description: 'Временные личные комнаты: лок, лимит, кик, блокировка участников — всё кнопками, без команд.',
        tag: 'Комьюнити',
    },
    {
        icon: ActivityIcon,
        title: 'Активность участников',
        description: 'Уровни за сообщения и время в голосовых, карточки профиля и топ сервера.',
        tag: 'Комьюнити',
    },
];

const TAGS: FeatureTag[] = ['Безопасность', 'Поддержка', 'Комьюнити'];

// Публичная страница продукта (extree.tech "/") — одностраничная
// прокрутка вместо прежней плавающей карточки-визитки: шапка-навигация,
// раздел "обо мне" (аватар/роль/био — то же редактируемое содержимое,
// что и раньше), фильтруемые по тегу карточки возможностей, затем
// редактируемые ссылки и контакт в конце. Структура подсмотрена у
// личных портфолио-сайтов (скроллинг + фильтр-чипы + карточки), но
// содержание — про сам продукт: Extree не ведёт чужие проекты, у него
// одна витрина.
export function VisitkaPage() {
    const [content, setContent] = useState<SiteContent | null>(null);
    const [activeTag, setActiveTag] = useState<FeatureTag | 'Все'>('Все');

    useEffect(() => {
        getSiteContent()
            .then(setContent)
            .catch(() => setContent(null));
    }, []);

    if (content) document.title = content.name;

    const visibleFeatures = useMemo(
        () => (activeTag === 'Все' ? FEATURES : FEATURES.filter(f => f.tag === activeTag)),
        [activeTag]
    );

    if (!content) {
        return (
            <div className={styles.page}>
                <div className={styles.backdrop} aria-hidden="true" />
                <div className={styles.blobA} aria-hidden="true" />
                <div className={styles.blobB} aria-hidden="true" />
                <div className={styles.blobC} aria-hidden="true" />
                <div className={styles.noise} aria-hidden="true" />
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.backdrop} aria-hidden="true" />
            <div className={styles.blobA} aria-hidden="true" />
            <div className={styles.blobB} aria-hidden="true" />
            <div className={styles.blobC} aria-hidden="true" />
            <div className={styles.noise} aria-hidden="true" />

            <nav className={styles.nav}>
                <a className={styles.navBrand} href="#top">
                    <BrandMark className={styles.navBadge} />
                    <span>{content.name}</span>
                </a>
                <div className={styles.navLinks}>
                    <a href="#about">Обо мне</a>
                    <a href="#features">Возможности</a>
                    <a href="#contact">Контакты</a>
                </div>
            </nav>

            <main className={styles.main}>
                <section id="top" className={styles.hero}>
                    <div className={styles.avatarRing}>
                        <img className={styles.avatar} src="/avatar.jpg" alt={content.name} />
                        <span className={styles.statusDot} aria-hidden="true" />
                    </div>
                    <h1 className={styles.name}>{content.name}</h1>
                    {content.role && <span className={styles.role}>{content.role}</span>}
                    {content.bio && (
                        <p id="about" className={styles.bio}>
                            {content.bio}
                        </p>
                    )}
                </section>

                <section id="features" className={styles.featuresSection}>
                    <h2 className={styles.sectionTitle}>Что умеет</h2>
                    <div className={styles.tagRow}>
                        <button
                            className={`${styles.tag} ${activeTag === 'Все' ? styles.tagActive : ''}`}
                            onClick={() => setActiveTag('Все')}
                        >
                            Все
                        </button>
                        {TAGS.map(tag => (
                            <button
                                key={tag}
                                className={`${styles.tag} ${activeTag === tag ? styles.tagActive : ''}`}
                                onClick={() => setActiveTag(tag)}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                    <div className={styles.featureGrid}>
                        {visibleFeatures.map(feature => (
                            <div key={feature.title} className={styles.featureCard}>
                                <span className={styles.featureIcon}>
                                    <feature.icon />
                                </span>
                                <h3 className={styles.featureTitle}>{feature.title}</h3>
                                <p className={styles.featureDescription}>{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {content.links.length > 0 && (
                    <section className={styles.linksSection}>
                        <h2 className={styles.sectionTitle}>Ссылки</h2>
                        <LinkList links={content.links} />
                    </section>
                )}

                <section id="contact" className={styles.contactSection}>
                    <h2 className={styles.contactTitle}>Нравится? Напиши</h2>
                    <p className={styles.contactLead}>По вопросам, предложениям или багам — пиши напрямую.</p>
                    <a className={styles.contactButton} href={`mailto:${CONTACT_EMAIL}`}>
                        {CONTACT_EMAIL}
                    </a>
                </section>
            </main>

            <footer className={styles.footer}>© {content.name}</footer>
        </div>
    );
}
