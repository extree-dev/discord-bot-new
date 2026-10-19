import { Link } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import { SignInPanel } from '../../widgets/sign-in-panel';
import styles from './index.module.scss';

export function SignInPage() {
    return (
        <div className={styles.page}>
            <div className={styles.backdrop} aria-hidden="true" />
            <SiteHeader />
            <main className={styles.main}>
                <SignInPanel />
            </main>
            <footer className={styles.footer}>
                part of extree.tech · <Link to="/terms">Terms of Use</Link>
            </footer>
        </div>
    );
}
