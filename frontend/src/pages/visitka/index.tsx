import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

// Layout and styles mirror frdg.work (Figma Sites), using values taken
// from the saved page: glass navigation over a white hero → about column,
// a client marquee with a label panel on the right, a work section with
// sticky tabs and side group labels, a contact block and a footer.
// Content is ours, from /api/site-content.

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

const PLATFORM_ICON_CLASS: Partial<Record<Platform, string>> = {
    discord: 'footerSocialIconDiscord',
    telegram: 'footerSocialIconTelegram',
    instagram: 'footerSocialIconInstagram',
    twitter: 'footerSocialIconTwitter',
    youtube: 'footerSocialIconYoutube',
    github: 'footerSocialIconGithub',
};

const NAV_LINKS = [
    { href: '#about', label: 'about me' },
    { href: '#clients', label: 'clients' },
    { href: '#work', label: 'work' },
    { href: '#contact', label: 'contact' },
];

function cx(...names: Array<string | false | null | undefined>): string {
    return names.filter(Boolean).join(' ');
}

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

// Hero: the icons drift a few pixels towards the cursor while it moves over
// the image (strongest for icons near the cursor, nothing for far ones),
// and ease back when it leaves. Offsets are written straight to the DOM
// inside requestAnimationFrame, so mouse moves never re-render React; the
// smoothness comes from the CSS transition on .heroIcon.
const ICON_MAX_SHIFT = 6; // px — "a couple of pixels"
const ICON_REACH = 380; // px — icons further than this from the cursor stay put

function HeroIconsLayer({ iconRefs }: { iconRefs: React.MutableRefObject<Array<SVGSVGElement | null>> }) {
    return (
        <>
            {heroIconPaths.map((path, index) => (
                <svg
                    key={index}
                    ref={el => {
                        iconRefs.current[index] = el;
                    }}
                    className={`${styles.heroIcon} ${styles[`heroIcon${index + 1}`]}`}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    {path}
                </svg>
            ))}
        </>
    );
}

function HeroCard({ title }: { title: string }) {
    const iconRefs = useRef<Array<SVGSVGElement | null>>([]);
    // Icon resting centers (current offset subtracted), cached per hover so
    // moving icons don't feed back into their own target.
    const centersRef = useRef<Array<{ x: number; y: number } | null>>([]);
    const shiftsRef = useRef<Array<{ x: number; y: number }>>([]);
    const frameRef = useRef(0);
    const pointerRef = useRef({ x: 0, y: 0 });
    const [pops, setPops] = useState(0);

    const measure = useCallback(() => {
        centersRef.current = iconRefs.current.map((el, i) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const shift = shiftsRef.current[i] ?? { x: 0, y: 0 };
            return { x: r.left + r.width / 2 - shift.x, y: r.top + r.height / 2 - shift.y };
        });
    }, []);

    const apply = useCallback(() => {
        frameRef.current = 0;
        const { x, y } = pointerRef.current;
        iconRefs.current.forEach((el, i) => {
            const c = centersRef.current[i];
            if (!el || !c) return;
            const dx = x - c.x;
            const dy = y - c.y;
            const dist = Math.hypot(dx, dy) || 1;
            const k = Math.max(0, 1 - dist / ICON_REACH);
            // ease-out falloff: near icons move the most, still capped at MAX_SHIFT
            const shift = ICON_MAX_SHIFT * k * k * (3 - 2 * k);
            const sx = (dx / dist) * shift;
            const sy = (dy / dist) * shift;
            shiftsRef.current[i] = { x: sx, y: sy };
            el.style.transform = `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px)`;
        });
    }, []);

    const onPointerEnter = useCallback(
        (e: React.PointerEvent) => {
            if (e.pointerType !== 'mouse') return;
            measure();
        },
        [measure]
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (e.pointerType !== 'mouse') return;
            if (centersRef.current.length === 0) measure();
            pointerRef.current = { x: e.clientX, y: e.clientY };
            if (!frameRef.current) frameRef.current = requestAnimationFrame(apply);
        },
        [apply, measure]
    );

    const onPointerLeave = useCallback(() => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
        centersRef.current = [];
        shiftsRef.current = [];
        iconRefs.current.forEach(el => {
            if (el) el.style.transform = '';
        });
    }, []);

    useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

    // Positions change on scroll/resize — drop the cache, re-measure on next move.
    useEffect(() => {
        const reset = () => {
            centersRef.current = [];
        };
        window.addEventListener('scroll', reset, { passive: true });
        window.addEventListener('resize', reset);
        return () => {
            window.removeEventListener('scroll', reset);
            window.removeEventListener('resize', reset);
        };
    }, []);

    return (
        <section
            className={styles.heroCard}
            onPointerEnter={onPointerEnter}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
        >
            <div className={styles.heroCardTexture} />
            <HeroIconsLayer iconRefs={iconRefs} />
            {/* key changes on every click, so the "pop" animation replays */}
            <p
                key={pops}
                className={pops ? `${styles.heroTitle} ${styles.heroTitlePop}` : styles.heroTitle}
                onClick={() => setPops(n => n + 1)}
            >
                {title}
            </p>
        </section>
    );
}

function Mark() {
    return (
        <span className={styles.mark} aria-hidden="true">
            <span className={styles.markRing} />
        </span>
    );
}

// Same markup for desktop and mobile: on desktop the logo and links are
// absolutely positioned inside the 580×80 pill (as on frdg.work); on
// mobile the CSS turns them into a regular flex row.
function Navigation() {
    return (
        <nav className={styles.navPill} aria-label="Navigation">
            <a className={styles.navLogo} href="#top" aria-label="Back to top">
                <Mark />
            </a>
            <div className={styles.navLinks}>
                {NAV_LINKS.map(link => (
                    <a key={link.href} href={link.href}>
                        {link.label}
                    </a>
                ))}
            </div>
        </nav>
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

const WORK_CATEGORY_ORDER: ShowcaseCategory[] = ['tools', 'communities', 'websites', 'branding'];
const WORK_CATEGORY_LABELS: Record<ShowcaseCategory, string> = {
    tools: 'Tools',
    communities: 'Communities',
    websites: 'Websites',
    branding: 'Branding',
};

// Scroll progress, as on frdg.work: the inner bar grows in width (not
// scaleX), so its rounded right edge doesn't get squashed.
// requestAnimationFrame batches all scroll events within one frame.
function ScrollProgressBar() {
    const innerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let frame = 0;
        function update() {
            frame = 0;
            const doc = document.documentElement;
            const scrollable = doc.scrollHeight - doc.clientHeight;
            const progress = scrollable > 0 ? doc.scrollTop / scrollable : 0;
            if (innerRef.current) innerRef.current.style.width = `${(progress * 100).toFixed(2)}%`;
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

    return (
        <div className={styles.scrollProgress} aria-hidden="true">
            <div className={styles.scrollProgressInner} ref={innerRef} />
        </div>
    );
}

// Fade + slide (24px) the first time an element enters the viewport,
// same values as frdg.work. A callback ref rather than useEffect: the
// node only appears once the content has loaded.
function useReveal<T extends HTMLElement>() {
    const [visible, setVisible] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);

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
            { threshold: 0.12 }
        );
        observer.observe(el);
        observerRef.current = observer;
    }, []);

    return { ref, visible };
}

// Active work tab: the group closest to the top of the viewport, below
// the sticky header (nav + tabs).
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey]);

    return active;
}

function ClientCard({ client, onLogoLoad }: { client: Client; onLogoLoad?: () => void }) {
    return (
        <li className={styles.clientCard}>
            <div className={styles.clientHead}>
                <img
                    className={styles.clientLogoImg}
                    src={client.logoUrl}
                    alt={`${client.name} logo`}
                    loading="lazy"
                    onLoad={onLogoLoad}
                />
                <span className={styles.clientName}>{client.name}</span>
            </div>
            {client.period && <span className={styles.clientPeriod}>{client.period}</span>}
        </li>
    );
}

// Seamless looping (duplicate the row + shift by -50%) is only enabled
// when the row is wider than its container, measured with a hidden probe.
function ClientsMarquee({ clients }: { clients: Client[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const probeRef = useRef<HTMLUListElement>(null);
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
        <div className={styles.marquee} ref={containerRef} role="marquee" aria-label="Clients">
            <ul className={styles.marqueeProbe} ref={probeRef} aria-hidden="true">
                {clients.map((client, index) => (
                    <ClientCard client={client} key={`probe-${client.name}-${index}`} onLogoLoad={measure} />
                ))}
            </ul>
            <ul className={shouldLoop ? styles.marqueeTrack : styles.marqueeTrackStatic}>
                {items.map((client, index) => (
                    <ClientCard client={client} key={`${client.name}-${index}`} />
                ))}
            </ul>
        </div>
    );
}

function ProjectCard({ item }: { item: WorkItem }) {
    const reveal = useReveal<HTMLElement>();

    return (
        <article ref={reveal.ref} className={cx(styles.projectCard, reveal.visible && styles.revealed)}>
            <div className={styles.projectBody}>
                {item.imageUrl && <img className={styles.projectImage} src={item.imageUrl} alt="" loading="lazy" />}
                <div className={styles.projectText}>
                    {item.tags.length > 0 && (
                        <div className={styles.tags}>
                            {item.tags.map(tag => (
                                <span key={tag}>{tag}</span>
                            ))}
                        </div>
                    )}
                    <h3 className={styles.projectTitle}>{item.title}</h3>
                    <p className={styles.projectCopy}>{item.copy}</p>
                </div>
            </div>
            {item.nda && <span className={styles.projectBlocked}>Non-disclosure agreement-bound</span>}
            {!item.nda && item.upcoming && <span className={styles.projectBlocked}>To be published</span>}
            {!item.nda && !item.upcoming && item.url && (
                <a className={styles.projectLink} href={item.url} target="_blank" rel="noreferrer">
                    <span>View website</span>
                    <ArrowUpRightIcon />
                </a>
            )}
        </article>
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

    // Hooks go before the early return so their call order never changes.
    const aboutReveal = useReveal<HTMLElement>();
    const clientsReveal = useReveal<HTMLElement>();
    const workReveal = useReveal<HTMLElement>();
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
            copy: `${community.members.toLocaleString('en-US')} members, ${community.online.toLocaleString('en-US')} online — ${community.responsibilities.join(', ')}`,
            url: community.url,
            category: 'communities' as const,
        })),
    ];

    // All 4 tabs are always shown (as on frdg.work); cards and scrollspy
    // only cover categories that actually have items.
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
        <div className={styles.page} id="top">
            <ScrollProgressBar />

            {noticeOpen && (
                <aside className={styles.notice}>
                    <span>Have a question or an interesting project? Email us at</span>
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                    <span>!</span>
                    <button
                        className={styles.noticeClose}
                        type="button"
                        aria-label="Close"
                        onClick={() => setNoticeOpen(false)}
                    >
                        <svg viewBox="0 0 10 10" aria-hidden="true">
                            <path d="M1 1l8 8M9 1l-8 8" />
                        </svg>
                    </button>
                </aside>
            )}

            {/* Mobile only: always-visible glass nav (hidden on desktop via CSS) */}
            <div className={styles.mobileNav}>
                <Navigation />
            </div>

            <header className={styles.hero}>
                <HeroCard title="extree.tech" />
            </header>

            <div className={styles.pageBody}>
                {/* Sticky navigation rail: from the bottom of the hero to the end of the page */}
                <div className={styles.navRail}>
                    <div className={styles.navSticky}>
                        <Navigation />
                    </div>
                </div>

                <div className={styles.navStrip} aria-hidden="true" />

                <section
                    ref={aboutReveal.ref}
                    className={cx(styles.about, aboutReveal.visible && styles.revealed)}
                    id="about"
                >
                    <h2 className={cx(styles.sectionLabel, styles.labelUp)}>about me</h2>
                    <div className={styles.aboutCopy}>
                        <div className={styles.aboutHeader}>
                            <h1 className={styles.aboutName}>{content.name}</h1>
                            {content.role && <span className={styles.aboutRole}>{content.role}</span>}
                        </div>
                        {content.bio && <p>{content.bio}</p>}
                    </div>
                    {LANGUAGES.length > 0 && (
                        <div className={styles.languages}>
                            <span className={styles.languagesLabel}>talk to me in</span>
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
                        className={cx(styles.clients, clientsReveal.visible && styles.revealed)}
                        id="clients"
                    >
                        <ClientsMarquee clients={clients} />
                        <div className={styles.clientsFadeLeft} aria-hidden="true" />
                        <div className={styles.clientsPanel}>
                            <h2 className={cx(styles.sectionLabel, styles.labelDown)}>clients</h2>
                        </div>
                    </section>
                )}

                {workItems.length > 0 && (
                    <section
                        ref={workReveal.ref}
                        className={cx(styles.work, workReveal.visible && styles.revealed)}
                        id="work"
                    >
                        <div className={styles.workFiltersRail}>
                            <div className={styles.workFiltersSticky}>
                                <nav className={styles.workFilters} aria-label="Work categories">
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
                                </nav>
                            </div>
                        </div>

                        <div className={styles.workLabelRail}>
                            <a className={styles.workLabel} href="#work">
                                <h2 className={cx(styles.sectionLabel, styles.labelUp)}>work</h2>
                            </a>
                        </div>

                        {/* Mobile only: sticks under the nav, behind the cards */}
                        <div className={styles.workMobileTitle} aria-hidden="true">
                            work
                        </div>

                        <div className={styles.workGroups}>
                            {populatedWorkGroups.map(group => (
                                <div
                                    className={styles.workGroup}
                                    id={`work-${group.id}`}
                                    key={group.id}
                                    data-work-category={group.id}
                                >
                                    <div className={styles.workGroupLabelRail}>
                                        <div className={styles.workGroupLabel}>
                                            <span className={styles.labelUp}>{group.id}</span>
                                        </div>
                                    </div>
                                    <div className={styles.projects}>
                                        {group.items.map(item => (
                                            <ProjectCard item={item} key={item.key} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section
                    ref={contactReveal.ref}
                    className={cx(styles.contact, contactReveal.visible && styles.revealed)}
                    id="contact"
                >
                    <div className={styles.contactInner}>
                        <p className={styles.contactLead}>Got a project or just a good idea?</p>
                        <div className={styles.contactBox}>
                            <span className={styles.contactBoxLabel}>or reach out via email</span>
                            <a className={styles.contactLink} href={`mailto:${CONTACT_EMAIL}`}>
                                {CONTACT_EMAIL}
                            </a>
                        </div>
                    </div>
                    <div className={styles.contactLabel}>
                        <h2 className={cx(styles.sectionLabel, styles.labelDown)}>contact</h2>
                    </div>
                </section>
            </div>

            <footer ref={footerReveal.ref} className={cx(styles.siteFooter, footerReveal.visible && styles.revealed)}>
                <div className={styles.footerRow}>
                    <div className={styles.footerBrand}>
                        <a className={styles.footerLogo} href="#top" aria-label="Back to top">
                            <Mark />
                            <span className={styles.footerBrandName}>extree.tech</span>
                        </a>

                        <nav className={styles.footerNav} aria-label="Sitemap">
                            {NAV_LINKS.map(link => (
                                <a key={link.href} href={link.href}>
                                    {link.label}
                                </a>
                            ))}
                        </nav>
                    </div>

                    {socialLinks.length > 0 && (
                        <div className={styles.footerSocial}>
                            {socialLinks.map(link => {
                                const platform = detectPlatform(link);
                                const Icon = PLATFORM_ICON[platform];
                                const colorClass = PLATFORM_ICON_CLASS[platform];
                                return (
                                    <a
                                        key={link.url}
                                        className={cx(styles.footerSocialIcon, colorClass && styles[colorClass])}
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
