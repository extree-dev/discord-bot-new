import { Link } from 'react-router-dom';
import styles from './index.module.scss';

// Вынесен из pages/sign-in в отдельный виджет, когда появилась вторая
// страница (pages/terms) — один и тот же хедер (марка + вордмарк,
// кликабельный, ведёт на "/") нужен на обеих, дублировать разметку
// значило бы разойтись при следующей правке бренда.
export function SiteHeader() {
    return (
        <header className={styles.header}>
            <Link to="/" className={styles.brandLink}>
                <span className={styles.mark} aria-hidden="true" />
                <span className={styles.brand}>EXTREE STATS</span>
            </Link>
        </header>
    );
}
