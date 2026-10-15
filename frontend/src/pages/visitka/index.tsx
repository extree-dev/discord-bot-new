import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Client, ShowcaseCategory } from '../../entities/site-content/types';
import {
    selectClients,
    selectCommunities,
    selectShowcases,
    selectSocialLinks,
    selectTools,
} from '../../entities/site-content/model/selectors';
import { useSiteContent } from '../../entities/site-content/model/useSiteContent';
import { LANGUAGES } from '../../features/language-picker/languages';
import { detectPlatform } from '../../shared/lib/platform';
import type { Platform } from '../../shared/lib/platform';
import { useDocumentMeta } from '../../shared/lib/useDocumentMeta';
import {
    ArrowUpRightIcon,
    DiscordIcon,
    GithubIcon,
    GlobeIcon,
    InstagramIcon,
    TelegramIcon,
    TwitterIcon,
    YoutubeIcon,
} from '../../shared/ui/icons';
import styles from './index.module.scss';

// Перенос визуального языка с extree-dev/testing-site (экспорт из
// Figma Make, редизайн визитки от фирмы) — структура и CSS взяты
// практически как есть, вместо демо-контента подставлен реальный
// с /api/site-content. Один файл, без промежуточных виджетов —
// как и в оригинальном App.tsx.

const CONTACT_EMAIL = 'support@extree.tech';

const PLATFORM_ICON: Record<Platform, () => React.ReactElement> = {
    discord: DiscordIcon,
    telegram: TelegramIcon,
    instagram: InstagramIcon,
    twitter: TwitterIcon,
    youtube: YoutubeIcon,
    github: GithubIcon,
    generic: GlobeIcon,
};

// Брендовый цвет иконки в футере (CSS-модуль, см. index.module.scss) —
// 'generic' намеренно без записи, у него нейтральный цвет по умолчанию.
const PLATFORM_ICON_CLASS: Partial<Record<Platform, string>> = {
    discord: 'footerSocialIconDiscord',
    telegram: 'footerSocialIconTelegram',
    instagram: 'footerSocialIconInstagram',
    twitter: 'footerSocialIconTwitter',
    youtube: 'footerSocialIconYoutube',
    github: 'footerSocialIconGithub',
};

const heroIconPaths = [
    <path key="1" d="M3 14.5h18M6 14.5V7h10v7.5M17.5 8h3v8h-3z" />,
    <path key="2" d="M6 3v18M10 3h8v18h-8M13 7h2M13 11h2M13 15h2" />,
    <path
        key="3"
        d="M5 5h14v14H5zM2 8V5a3 3 0 0 1 3-3h3M22 8V5a3 3 0 0 0-3-3h-3M2 16v3a3 3 0 0 0 3 3h3M22 16v3a3 3 0 0 1-3 3h-3M9 16l3-8 3 8M10 13h4"
    />,
    <path key="4" d="M4 18l8-12 2 6 6-2-8 10-2-5zM18 3v3M21 6l-2 2M15 5l-2-2" />,
    <path key="5" d="M4 17h16M6 14V5h12v9M8 8h8M8 11h5" />,
    <path key="6" d="M4 8c3-5 9-4 10 0 5-1 8 5 4 8-3 3-8 1-9-2-3 2-7 0-7-3 0-2 1-3 2-3zM15 17l3 3M18 17l-3 3" />,
    <path key="7" d="M4 5h13v11H4zM8 19h12V9M17 5l3-3M17 5h5V0" />,
    <path key="8" d="M4 17l4-11 6 4 6-2-1 11-8-2zM8 6l3 11M14 10l5 9" />,
    <path key="9" d="M3 17c3-10 5 5 8-5s4 9 10-3" />,
    <path key="10" d="M3 6h8v8H3zM13 6h8v8h-8M3 17h18" />,
];

interface IconOffset {
    x: number;
    y: number;
}

const ZERO_OFFSET: IconOffset = { x: 0, y: 0 };

interface HeroIconProps {
    index: number;
    offset: IconOffset;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
}

// forwardRef — родитель (HeroIconsLayer) меряет расстояния между иконками
// через getBoundingClientRect(), а не хранит координаты отдельно в JS:
// позиции и так заданы в CSS (top/left в процентах), дублировать их
// в коде — источник рассинхрона при любой правке вёрстки.
const HeroIcon = forwardRef<SVGSVGElement, HeroIconProps>(function HeroIcon(
    { index, offset, onPointerEnter, onPointerLeave },
    ref
) {
    return (
        <svg
            ref={ref}
            className={`${styles.heroIcon} ${styles[`heroIcon${index + 1}`]}`}
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={offset.x || offset.y ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
        >
            {heroIconPaths[index]}
        </svg>
    );
});

// Лёгкий "магнитный" ховер по референс-скриншотам фактического сайта:
// при наведении на иконку соседние чуть смещаются в её сторону (не от
// неё) — реагируют только те, что физически рядом (дальше MAX_DIST —
// без сдвига). Считаем через getBoundingClientRect() только по events
// наведения (не на каждый mousemove) — дешевле и этого достаточно для
// едва заметного эффекта.
function HeroIconsLayer() {
    const iconRefs = useRef<Array<SVGSVGElement | null>>([]);
    const [offsets, setOffsets] = useState<IconOffset[]>(() => heroIconPaths.map(() => ZERO_OFFSET));

    const handleEnter = useCallback((index: number) => {
        const icons = iconRefs.current;
        const hovered = icons[index];
        if (!hovered) return;
        const hoveredRect = hovered.getBoundingClientRect();
        const hoveredCenter = {
            x: hoveredRect.left + hoveredRect.width / 2,
            y: hoveredRect.top + hoveredRect.height / 2,
        };
        const MAX_DIST = 220;
        const MAX_SHIFT = 7;
        setOffsets(
            icons.map((el, i) => {
                if (!el || i === index) return ZERO_OFFSET;
                const rect = el.getBoundingClientRect();
                const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                const dx = hoveredCenter.x - center.x;
                const dy = hoveredCenter.y - center.y;
                const dist = Math.hypot(dx, dy) || 1;
                if (dist > MAX_DIST) return ZERO_OFFSET;
                const strength = (1 - dist / MAX_DIST) * MAX_SHIFT;
                return { x: (dx / dist) * strength, y: (dy / dist) * strength };
            })
        );
    }, []);

    const handleLeave = useCallback(() => {
        setOffsets(heroIconPaths.map(() => ZERO_OFFSET));
    }, []);

    return (
        <>
            {heroIconPaths.map((_, index) => (
                <HeroIcon
                    index={index}
                    key={index}
                    ref={el => {
                        iconRefs.current[index] = el;
                    }}
                    offset={offsets[index]}
                    onPointerEnter={() => handleEnter(index)}
                    onPointerLeave={handleLeave}
                />
            ))}
        </>
    );
}

function Mark() {
    return (
        <span className={styles.mark} aria-hidden="true">
            <span className={styles.markRing} />
        </span>
    );
}

interface NavigationProps {
    className?: string;
}

function Navigation({ className }: NavigationProps) {
    return (
        <div className={className ? `${styles.navPill} ${className}` : styles.navPill}>
            <a href="#top" aria-label="В начало">
                <Mark />
            </a>
            <a href="#about">about me</a>
            <a href="#clients">clients</a>
            <a href="#work">work</a>
            <a href="#contact">contact</a>
        </div>
    );
}

interface WorkItem {
    key: string;
    title: string;
    tags: string[];
    copy: string;
    imageUrl?: string;
    url?: string;
    nda?: boolean;
    upcoming?: boolean;
    category: ShowcaseCategory;
}

// Вкладки секции "work" — как на референсе (frdg.work): Tools/
// Communities/Websites/Branding, в этом порядке. Рендерится только
// вкладка, в которой реально есть хотя бы одна карточка — см.
// groupedWork ниже.
const WORK_CATEGORY_ORDER: ShowcaseCategory[] = ['tools', 'communities', 'websites', 'branding'];
const WORK_CATEGORY_LABELS: Record<ShowcaseCategory, string> = {
    tools: 'Tools',
    communities: 'Communities',
    websites: 'Websites',
    branding: 'Branding',
};

function formatIndex(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}

// Полоска прогресса прокрутки — ширина через transform: scaleX на ref,
// а не через React state/setState на каждый scroll (дорого при частых
// событиях); requestAnimationFrame схлопывает несколько scroll-событий
// одного кадра в одно обновление стиля.
function ScrollProgressBar() {
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let frame = 0;
        function update() {
            frame = 0;
            const doc = document.documentElement;
            const scrollable = doc.scrollHeight - doc.clientHeight;
            const progress = scrollable > 0 ? doc.scrollTop / scrollable : 0;
            if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
        }
        function onScroll() {
            if (!frame) frame = requestAnimationFrame(update);
        }
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    return <div className={styles.scrollProgress} ref={barRef} aria-hidden="true" />;
}

// Секции не должны "резко" появляться при первом скролле к ним — лёгкий
// fade+slide через IntersectionObserver, один раз на секцию (отключаем
// наблюдение сразу после первого пересечения — дальше не нужно).
function useReveal<T extends HTMLElement>() {
    const [visible, setVisible] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Колбэк-реф вместо useEffect(..., []) — пока content === null, страница
    // рендерит скелетон без секций, и нужный DOM-узел появляется только
    // на следующем рендере; эффект с пустым массивом зависимостей к тому
    // моменту уже отработал бы на ref.current === null и больше не
    // перезапустился бы. Колбэк-реф вызывается при каждом монтировании узла.
    const ref = useCallback((el: T | null) => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return;
        }
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.15 }
        );
        observer.observe(el);
        observerRef.current = observer;
    }, []);

    return { ref, visible };
}

// Какая вкладка секции work сейчас "активна" при скролле — как на
// референсе (frdg.work): сама панель вкладок sticky и остаётся на месте
// (см. .workFilters), а подсветка переключается на ту вкладку, чья
// группа карточек ближе всего к верху вьюпорта. rootMargin сдвигает
// зону срабатывания под sticky-шапку (нав + вкладки) и не даёт переходу
// сработать раньше времени — триггерим задолго до того, как группа
// полностью уйдёт из вида (-60% снизу), а не только у самого верха.
function useScrollSpy(ids: string[]): string | null {
    const idsKey = ids.join('|');
    const [active, setActive] = useState<string | null>(ids[0] ?? null);

    useEffect(() => {
        if (ids.length <= 1) return undefined;
        if (typeof IntersectionObserver === 'undefined') return undefined;

        const elements = ids.map(id => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
        if (elements.length === 0) return undefined;

        const observer = new IntersectionObserver(
            entries => {
                const visible = entries.filter(entry => entry.isIntersecting);
                if (visible.length === 0) return;
                const topMost = visible.reduce((a, b) =>
                    a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
                );
                setActive(topMost.target.id);
            },
            { rootMargin: '-140px 0px -60% 0px', threshold: 0 }
        );
        elements.forEach(el => observer.observe(el));
        return () => observer.disconnect();
        // idsKey — стабильное сравнение вместо ids (новый массив на каждый рендер).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey]);

    return active;
}

// На мобильной раскладке навигационная панель — position: fixed, и по
// умолчанию она «висит» до конца страницы. Просили скрывать её, когда
// секция work уходит за верх экрана. Отслеживаем положение .work через
// IntersectionObserver: пока она хоть частично в вьюпорте (или ещё ниже
// его), панель видна; когда секция уехала выше вьюпорта — панель гаснет
// (opacity 0 + pointer-events: none).
function useMobileNavVisible(workRef: React.RefObject<HTMLElement | null>, enabled: boolean) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (!enabled) {
            setVisible(true);
            return undefined;
        }
        const el = workRef.current;
        if (!el) return undefined;
        if (typeof IntersectionObserver === 'undefined') return undefined;

        const observer = new IntersectionObserver(
            ([entry]) => {
                // Показываем, если work пересекается со вьюпортом ИЛИ ещё
                // не дошёл до него (top > 0 — секция ниже области видимости).
                setVisible(entry.isIntersecting || entry.boundingClientRect.top > 0);
            },
            { threshold: 0 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [enabled, workRef]);

    return visible;
}

// Бесшовная прокрутка строится дублированием ряда ([...clients, ...clients])
// и сдвигом на -50% — это ломается визуально, если сам ряд логотипов (без
// дублирования) короче контейнера: вместо прокрутки видно сразу оба
// повтора рядом, и кажется, что логотип "двоится" (особенно заметно при
// одном клиенте или при нескольких, но с узкими логотипами). Поэтому
// дублирование и анимацию включаем только когда реальная ширина ряда
// превышает ширину контейнера — меряем скрытым "пробником" с тем же
// списком логотипов.
// Карточка клиента — лого + название + период работы (вместо монохромного
// лого в бегущей строке — см. index.module.scss для источника).
function ClientCard({ client, onLogoLoad }: { client: Client; onLogoLoad?: () => void }) {
    return (
        <div className={styles.clientCard}>
            <img
                className={styles.clientLogoImg}
                src={client.logoUrl}
                alt={client.name}
                loading="lazy"
                onLoad={onLogoLoad}
            />
            <span className={styles.clientName}>{client.name}</span>
            {client.period && <span className={styles.clientPeriod}>{client.period}</span>}
        </div>
    );
}

function ClientsMarquee({ clients }: { clients: Client[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const probeRef = useRef<HTMLDivElement>(null);
    const [shouldLoop, setShouldLoop] = useState(false);

    const measure = useCallback(() => {
        const container = containerRef.current;
        const probe = probeRef.current;
        if (!container || !probe) return;
        setShouldLoop(probe.scrollWidth > container.clientWidth);
    }, []);

    useLayoutEffect(() => {
        measure();
    }, [measure, clients]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        return () => observer.disconnect();
    }, [measure]);

    const items = shouldLoop ? [...clients, ...clients] : clients;

    return (
        <div className={styles.marquee} ref={containerRef}>
            <div className={styles.marqueeProbe} ref={probeRef} aria-hidden="true">
                {clients.map((client, index) => (
                    <ClientCard client={client} key={`probe-${client.name}-${index}`} onLogoLoad={measure} />
                ))}
            </div>
            <div className={shouldLoop ? styles.marqueeTrack : styles.marqueeTrackStatic}>
                {items.map((client, index) => (
                    <ClientCard client={client} key={`${client.name}-${index}`} />
                ))}
            </div>
        </div>
    );
}

export function VisitkaPage() {
    const content = useSiteContent();
    const [noticeOpen, setNoticeOpen] = useState(true);

    useDocumentMeta({
        title: content?.name ?? null,
        lang: 'en',
        description: content?.bio,
        ogImage: '/avatar.jpg',
    });

    useEffect(() => {
        document.documentElement.style.scrollBehavior = 'smooth';
        return () => {
            document.documentElement.style.scrollBehavior = '';
        };
    }, []);

    // До раннего return (!content) — хуки должны вызываться в одном и том
    // же порядке на каждый рендер, иначе React теряет их состояние. Поэтому
    // workItems/groupedWork тоже считаются здесь (с content ? guard'ом на
    // каждый селектор), а не после return — useScrollSpy ниже их использует.
    const aboutReveal = useReveal<HTMLElement>();
    const clientsReveal = useReveal<HTMLElement>();
    const contactReveal = useReveal<HTMLElement>();
    const footerReveal = useReveal<HTMLElement>();

    const tools = content ? selectTools(content) : [];
    const showcases = content ? selectShowcases(content) : [];
    const communities = content ? selectCommunities(content) : [];

    const workItems: WorkItem[] = [
        ...tools.map(tool => ({
            key: `tool-${tool.title}`,
            title: tool.title,
            tags: tool.tags,
            copy: tool.description,
            url: tool.url,
            nda: tool.nda,
            upcoming: tool.upcoming,
            category: 'tools' as const,
        })),
        ...showcases.map(showcase => ({
            key: `showcase-${showcase.title}`,
            title: showcase.title,
            tags: showcase.tags,
            copy: showcase.description,
            imageUrl: showcase.imageUrl,
            url: showcase.url,
            nda: showcase.nda,
            upcoming: showcase.upcoming,
            category: showcase.category ?? ('websites' as const),
        })),
        ...communities.map(community => ({
            key: `community-${community.name}`,
            title: community.title,
            tags: ['Community'],
            copy: `${community.members.toLocaleString('en-US')} участников, ${community.online.toLocaleString('en-US')} онлайн — ${community.responsibilities.join(', ')}`,
            url: community.url,
            category: 'communities' as const,
        })),
    ];
    // Все 4 вкладки показываются всегда (как на референсе frdg.work), даже
    // если в части категорий пока нет ни одной карточки — иначе, пока
    // заполнена только одна категория (как сейчас на проде), панель вкладок
    // пропадала бы целиком и выглядело так, будто вкладок вообще нет.
    // Карточки же рендерятся (и участвуют в scrollspy) только для реально
    // заполненных категорий — populatedWorkGroups.
    const groupedWork = useMemo(
        () =>
            WORK_CATEGORY_ORDER.map(category => ({
                id: category,
                label: WORK_CATEGORY_LABELS[category],
                items: workItems.filter(item => item.category === category),
            })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tools, showcases, communities]
    );
    const populatedWorkGroups = useMemo(() => groupedWork.filter(group => group.items.length > 0), [groupedWork]);
    const workCategoryIds = useMemo(() => populatedWorkGroups.map(group => `work-${group.id}`), [populatedWorkGroups]);
    const activeWorkCategory = useScrollSpy(workCategoryIds);

    // Скрытие мобильной навигации, когда секция work уехала выше вьюпорта.
    // Observer подключён всегда — CSS сам решает, что .mobileNav виден
    // только на мобильной раскладке (display: none на десктопе). Внутри
    // хука enabled = true (активно только на мобилке — media-query
    // здесь не нужен, т.к. сам элемент на десктопе скрыт).
    const workRef = useRef<HTMLElement | null>(null);
    const mobileNavVisible = useMobileNavVisible(workRef, true);

    if (!content) {
        return (
            <div className={styles.page}>
                <div className={styles.skeleton} aria-hidden="true" />
            </div>
        );
    }

    const socialLinks = selectSocialLinks(content);
    const clients = selectClients(content);

    return (
        <div className={noticeOpen ? `${styles.page} ${styles.hasNotice}` : styles.page} id="top">
            <ScrollProgressBar />
            {noticeOpen && (
                <aside className={styles.notice}>
                    <span>
                        Есть вопрос или интересный проект? Напишите на{' '}
                        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                    </span>
                    <button type="button" aria-label="Закрыть" onClick={() => setNoticeOpen(false)}>
                        ×
                    </button>
                </aside>
            )}

            {/* .mobileNav — единственный владелец навигации на мобилке.
                style.opacity управляет видимостью: пока секция work
                в вьюпорте (или ещё ниже) — нав виден, когда work уехал
                выше — гаснет. На десктопе .mobileNav скрыт через CSS,
                поэтому эта логика не влияет. */}
            <div
                className={styles.mobileNav}
                style={{
                    opacity: mobileNavVisible ? 1 : 0,
                    pointerEvents: mobileNavVisible ? 'auto' : 'none',
                    transition: 'opacity 200ms ease',
                }}
            >
                <Navigation />
            </div>

            <section className={styles.heroCard}>
                <div className={styles.heroCardTexture} />
                <HeroIconsLayer />
                <h1>extree.tech</h1>
            </section>

            {/* .pageBody — контейнер для sticky-позиционирования desktop-навигации:
               position: sticky «прилипает» в пределах ближайшего родительского
               блока, а не всей страницы, поэтому непосредственный родитель
               панели должен быть высотой во весь остаток страницы (а не
               короткая 110px-строка, как раньше — см. комментарий у .navPillDesktop). */}
            <div className={styles.pageBody}>
                <Navigation className={styles.navPillDesktop} />
                <section
                    ref={aboutReveal.ref}
                    className={`${styles.about} ${aboutReveal.visible ? styles.revealed : ''}`}
                    id="about"
                >
                    <h2 className={styles.sectionLabel}>about me</h2>
                    <div className={styles.aboutCopy}>
                        <div className={styles.aboutHeader}>
                            <h1 className={styles.aboutName}>{content.name}</h1>
                            {content.role && <span className={styles.aboutRole}>{content.role}</span>}
                        </div>
                        {content.bio && <p>{content.bio}</p>}
                    </div>
                    {LANGUAGES.length > 0 && (
                        <div className={styles.languages}>
                            <span>talk to me in</span>
                            <div className={styles.languagesRow}>
                                {LANGUAGES.map(lang => (
                                    <span key={lang.code} className={styles.languageBox}>
                                        <span className={styles.languageFlag} aria-hidden="true">
                                            <lang.Flag />
                                        </span>
                                        {lang.code}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {clients.length > 0 && (
                    <section
                        ref={clientsReveal.ref}
                        className={`${styles.clients} ${clientsReveal.visible ? styles.revealed : ''}`}
                        id="clients"
                    >
                        <h2 className={styles.sectionLabel}>clients</h2>
                        <ClientsMarquee clients={clients} />
                    </section>
                )}

                {workItems.length > 0 && (
                    <section className={styles.work} id="work" ref={workRef}>
                        {/* Левая колонка: вертикальный заголовок "work". */}
                        <div className={styles.TitleWork}>
                            <h2 className={styles.workTitle}>work</h2>
                        </div>

                        {/* Фильтры — прямой ребёнок .work, растянуты на обе
                            колонки (grid-column: 1 / -1), центрируются по всей
                            ширине секции, а не по правой колонке. */}
                        <div className={styles.workFiltersSticky}>
                            <div className={styles.workFilters}>
                                {groupedWork.map(group =>
                                    group.items.length > 0 ? (
                                        <a
                                            key={group.id}
                                            href={`#work-${group.id}`}
                                            className={
                                                activeWorkCategory === `work-${group.id}`
                                                    ? styles.workFilterActive
                                                    : undefined
                                            }
                                        >
                                            {group.label}
                                        </a>
                                    ) : (
                                        <span key={group.id} className={styles.workFilterEmpty}>
                                            {group.label}
                                        </span>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Карточки — во второй колонке, внутри .workContent,
                            чтобы grid видел их как один элемент. */}
                        <div className={styles.workContent}>
                            {populatedWorkGroups.map(group => (
                                <div
                                    className={styles.projects}
                                    id={`work-${group.id}`}
                                    key={group.id}
                                    data-work-category={group.id}
                                >
                                    {group.items.map((item, index) => (
                                        <article className={styles.projectCard} key={item.key}>
                                            {item.imageUrl && (
                                                <img className={styles.projectImage} src={item.imageUrl} alt="" />
                                            )}
                                            {item.tags.length > 0 && (
                                                <div className={styles.tags}>
                                                    {item.tags.map(tag => (
                                                        <span key={tag}>{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                            <h3 className={styles.projectTitle}>{item.title}</h3>
                                            <p className={styles.projectCopy}>{item.copy}</p>
                                            {item.nda && (
                                                <span className={styles.projectBlocked}>
                                                    Non-disclosure agreement-bound
                                                </span>
                                            )}
                                            {item.upcoming && (
                                                <span className={styles.projectBlocked}>To be published</span>
                                            )}
                                            {!item.nda && !item.upcoming && item.url && (
                                                <a
                                                    className={styles.projectLink}
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    <span>Смотреть проект</span>
                                                    <ArrowUpRightIcon />
                                                </a>
                                            )}
                                            <span className={styles.projectIndex}>{formatIndex(index + 1)}</span>
                                        </article>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section
                    ref={contactReveal.ref}
                    className={`${styles.contact} ${contactReveal.visible ? styles.revealed : ''}`}
                    id="contact"
                >
                    <h2 className={styles.sectionLabel}>contact</h2>
                    <div className={styles.contactCard}>
                        <p>Есть проект или просто хорошая идея?</p>
                        <a className={styles.contactLink} href={`mailto:${CONTACT_EMAIL}`}>
                            {CONTACT_EMAIL}
                        </a>
                    </div>
                </section>
            </div>

            <footer
                ref={footerReveal.ref}
                className={`${styles.siteFooter} ${footerReveal.visible ? styles.revealed : ''}`}
            >
                <div className={styles.footerRow}>
                    <div className={styles.footerBrand}>
                        <Mark />
                        <span className={styles.footerBrandName}>extree.tech</span>
                    </div>

                    <nav className={styles.footerNav} aria-label="Карта сайта">
                        <a href="#about">about me</a>
                        <a href="#clients">clients</a>
                        <a href="#work">work</a>
                        <a href="#contact">contact</a>
                    </nav>

                    {socialLinks.length > 0 && (
                        <div className={styles.footerSocial}>
                            {socialLinks.map(link => {
                                const platform = detectPlatform(link);
                                const Icon = PLATFORM_ICON[platform];
                                const colorClass = PLATFORM_ICON_CLASS[platform];
                                const className = colorClass
                                    ? `${styles.footerSocialIcon} ${styles[colorClass]}`
                                    : styles.footerSocialIcon;
                                return (
                                    <a
                                        key={link.url}
                                        className={className}
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
                </div>
            </footer>
        </div>
    );
}
