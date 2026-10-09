import { useEffect, useState } from 'react';
import { getSiteContent } from '../../entities/site-content/api';
import type { SiteContent } from '../../entities/site-content/types';
import { LinkList } from '../../widgets/link-list/LinkList';
import styles from './VisitkaPage.module.css';

// Публичная link-in-bio страница (extree.tech "/") — сознательно БЕЗ
// AppShell: его фирменный хедер с лого/названием сделан для внутренних
// страниц продукта (кабинет, редактор), а здесь сама эта страница —
// весь "продукт", как у Linktree и подобных сервисов.
//
// Макет: круглый аватар с градиентным кольцом (+ живой "online"-индикатор,
// как у реальных bio-сервисов), наполовину нависающий над стеклянной
// карточкой профиля. Карточка плавает над фоном с тремя независимо
// "дышащими" цветовыми пятнами (а не статичной картинкой) и тонкой
// зерном-текстурой сверху — вместе это даёт настоящую, а не нарисованную,
// глубину "жидкого стекла".
export function VisitkaPage() {
    const [content, setContent] = useState<SiteContent | null>(null);

    useEffect(() => {
        getSiteContent()
            .then(setContent)
            .catch(() => setContent(null));
    }, []);

    if (content) document.title = content.name;

    return (
        <div className={styles.page}>
            <div className={styles.backdrop} aria-hidden="true" />
            <div className={styles.blobA} aria-hidden="true" />
            <div className={styles.blobB} aria-hidden="true" />
            <div className={styles.blobC} aria-hidden="true" />
            <div className={styles.noise} aria-hidden="true" />
            {content && (
                <div className={styles.frame}>
                    <main className={styles.card}>
                        <div className={styles.cardSheen} aria-hidden="true" />
                        <div className={styles.avatarRing}>
                            <img className={styles.avatar} src="/avatar.jpg" alt={content.name} />
                            <span className={styles.statusDot} aria-hidden="true" />
                        </div>
                        <h1 className={styles.name}>{content.name}</h1>
                        {content.role && <span className={styles.role}>{content.role}</span>}
                        {content.bio && <p className={styles.bio}>{content.bio}</p>}
                        <LinkList links={content.links} />
                        <footer className={styles.footer}>© {content.name}</footer>
                    </main>
                </div>
            )}
        </div>
    );
}
