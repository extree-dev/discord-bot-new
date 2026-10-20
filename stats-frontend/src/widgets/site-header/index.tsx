import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './index.module.scss';

interface SiteHeaderProps {
    rightSlot?: ReactNode;
    actions?: ReactNode;
}

// Вынесен из pages/sign-in в отдельный виджет, когда появилась вторая
// страница (pages/terms) — один и тот же хедер (марка + вордмарк,
// кликабельный, ведёт на "/") нужен на обеих, дублировать разметку
// значило бы разойтись при следующей правке бренда. rightSlot — для
// простых текстовых ссылок (Terms/Privacy); actions — отдельный слот под
// настоящие Button-компоненты (Log in/Sign up) — раньше они жили в
// rightSlot вперемешку с текстовыми ссылками, и глобальный `.right a`
// (цвет/без подчёркивания) ломал вид самих кнопок.
export function SiteHeader({ rightSlot, actions }: SiteHeaderProps) {
    return (
        <header className={styles.header}>
            <Link to="/" className={styles.brandLink}>
                <img src="/logo.png" alt="" className={styles.mark} aria-hidden="true" />
                <span className={styles.brand}>Extree Stats</span>
            </Link>
            <div className={styles.navRight}>
                {rightSlot && <div className={styles.right}>{rightSlot}</div>}
                {actions && <div className={styles.actions}>{actions}</div>}
            </div>
        </header>
    );
}
