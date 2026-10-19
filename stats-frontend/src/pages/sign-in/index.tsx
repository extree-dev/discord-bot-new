import { SignInPanel } from '../../widgets/sign-in-panel';
import styles from './index.module.scss';

export function SignInPage() {
    return (
        <div className={styles.page}>
            <div className={styles.backdrop} aria-hidden="true" />
            <header className={styles.header}>
                <span className={styles.mark} aria-hidden="true" />
                <span className={styles.brand}>EXTREE STATS</span>
            </header>
            <main className={styles.main}>
                <SignInPanel />
            </main>
            <footer className={styles.footer}>part of extree.tech</footer>
        </div>
    );
}
