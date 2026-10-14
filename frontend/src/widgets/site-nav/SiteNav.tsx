import styles from './SiteNav.module.css';

// Капсула-навигация визитки. Ссылки захардкожены — у страницы ровно
// две якорные секции, плодить конфиг ради двух строк не стоит.
// Если появится третья — вынесем в shared/config/nav.ts.
export function SiteNav() {
    return (
        <nav className={styles.nav}>
            <div className={styles.links}>
                <a href="#about">About me</a>
                <a href="#contact">Contact</a>
            </div>
        </nav>
    );
}