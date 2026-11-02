import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SiteHeader } from '../../../widgets/site-header';
import styles from './index.module.scss';

interface LegalLayoutProps {
    title: string;
    lastUpdated: string;
    children: ReactNode;
}

export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
    const [headings, setHeadings] = useState<{ id: string; text: string }[]>([]);
    const location = useLocation();

    // Собираем заголовки и генерируем для них ID прямо в DOM
    useEffect(() => {
        const article = document.querySelector('article');
        if (!article) return;

        const h2s = Array.from(article.querySelectorAll('h2'));
        const items = h2s.map((h2, index) => {
            // Если ID нет, создаем его на основе текста + индекса (чтобы избежать дубликатов)
            if (!h2.id) {
                const safeId = `section-${index}`;
                h2.id = safeId;
            }
            return { id: h2.id, text: h2.textContent || '' };
        });
        setHeadings(items);
    }, [children]);

    return (
        <div className={styles.page}>
            <SiteHeader
                rightSlot={
                    <>
                        <Link to="/privacy" className={location.pathname === '/privacy' ? styles.activeLink : ''}>
                            Privacy
                        </Link>
                        <span aria-hidden="true"> · </span>
                        <Link to="/terms" className={location.pathname === '/terms' ? styles.activeLink : ''}>
                            Terms
                        </Link>
                        <span aria-hidden="true"> · </span>
                        <Link to="/cookies" className={location.pathname === '/cookies' ? styles.activeLink : ''}>
                            Cookies
                        </Link>
                    </>
                }
            />

            <main className={styles.main}>
                <div className={styles.layout}>
                    {/* Оглавление (сайдбар) */}
                    {headings.length > 0 && (
                        <aside className={styles.sidebar}>
                            <div className={styles.sidebarSticky}>
                                <h3 className={styles.tocTitle}>Contents</h3>
                                <nav className={styles.tocNav}>
                                    {headings.map((h, i) => (
                                        <a
                                            key={i}
                                            href={`#${h.id}`}
                                            className={styles.tocLink}
                                            // Убрали preventDefault — пусть браузер сам скроллит
                                        >
                                            {h.text}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                        </aside>
                    )}

                    {/* Основной контент */}
                    <article className={styles.article}>
                        <p className={styles.updated}>Last updated: {lastUpdated}</p>
                        <h1>{title}</h1>
                        {children}
                    </article>
                </div>
            </main>

            <footer className={styles.footer}>part of extree.tech</footer>
        </div>
    );
}
