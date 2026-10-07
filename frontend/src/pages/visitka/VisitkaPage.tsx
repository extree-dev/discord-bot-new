import { useEffect, useState } from 'react';
import { getSiteContent } from '../../entities/site-content/api';
import type { SiteContent } from '../../entities/site-content/types';
import { LinkList } from '../../widgets/link-list/LinkList';
import styles from './VisitkaPage.module.css';

// Публичная link-in-bio страница (extree.tech "/") — сознательно БЕЗ
// AppShell: его фирменный хедер с лого/названием сделан для внутренних
// страниц продукта (кабинет, редактор), а здесь сама эта страница —
// весь "продукт", как у Linktree и подобных сервисов: фото — не круглый
// аватар, а баннер на всю ширину экрана сверху, плавно растворяющийся
// в фоне, а не квадрат с отступами по бокам.
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
            {content && (
                <>
                    <div className={styles.banner}>
                        <img className={styles.bannerImg} src="/avatar.jpg" alt={content.name} />
                    </div>
                    <main className={styles.content}>
                        <h1 className={styles.name}>{content.name}</h1>
                        {content.role && <p className={styles.role}>{content.role}</p>}
                        {content.bio && <p className={styles.bio}>{content.bio}</p>}
                        <LinkList links={content.links} />
                        <footer className={styles.footer}>© {content.name}</footer>
                    </main>
                </>
            )}
        </div>
    );
}
