import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './index.module.scss';

interface SiteHeaderProps {
    rightSlot?: ReactNode;
}

// Вынесен из pages/sign-in в отдельный виджет, когда появилась вторая
// страница (pages/terms) — один и тот же хедер (марка + вордмарк,
// кликабельный, ведёт на "/") нужен на обеих, дублировать разметку
// значило бы разойтись при следующей правке бренда. rightSlot — для
// ссылки "Terms of Use" в наве страницы входа; на самой странице терминов
// она не нужна (это была бы ссылка на саму себя), поэтому необязательная.
export function SiteHeader({ rightSlot }: SiteHeaderProps) {
    return (
        <header className={styles.header}>
            <Link to="/" className={styles.brandLink}>
                <span className={styles.mark} aria-hidden="true" />
                <span className={styles.brand}>EXTREE STATS</span>
            </Link>
            {rightSlot && <div className={styles.right}>{rightSlot}</div>}
        </header>
    );
}
