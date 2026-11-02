import { Link } from 'react-router-dom';
import { LegalLayout } from '../../shared/ui/LegalLayout';
import { useConsent } from '../../shared/consent/useConsent';
import { Button } from '../../shared/ui/Button';
import styles from './index.module.scss';

export function CookiesPage() {
    const { consent, reopen } = useConsent();

    return (
        <LegalLayout title="Cookie Policy" lastUpdated="October 29, 2026">
            <p>
                This page lists every cookie and third-party service Extree Stats (stats.extree.tech) uses, what each is
                for, and how long it lasts.
            </p>

            <h2>Necessary — always on</h2>
            <p>
                These keep the site working and secure. They're strictly necessary under GDPR/ePrivacy, so they don't
                require consent and can't be turned off.
            </p>

            <div className={styles.cookieGrid}>
                <div className={styles.cookieCard}>
                    <div className={styles.cookieHeader}>
                        <code className={styles.cookieName}>extree_stats_session</code>
                        <span className={styles.cookieBadge}>7 days</span>
                    </div>
                    <p className={styles.cookieDesc}>
                        Keeps you signed in. Holds an encrypted, <code>httpOnly</code> token identifying your account —
                        it can't be read or modified from your browser.
                    </p>
                </div>

                <div className={styles.cookieCard}>
                    <div className={styles.cookieHeader}>
                        <code className={styles.cookieName}>csrf</code>
                        <span className={styles.cookieBadge}>2 hours</span>
                    </div>
                    <p className={styles.cookieDesc}>
                        Prevents cross-site request forgery on forms and account actions.
                    </p>
                </div>

                <div className={styles.cookieCard}>
                    <div className={styles.cookieHeader}>
                        <code className={styles.cookieName}>extree_stats_oauth_state</code>
                        <span className={styles.cookieBadge}>10 minutes</span>
                    </div>
                    <p className={styles.cookieDesc}>
                        Prevents cross-site request forgery during Riot Sign-On (RSO) redirects. Deleted once the
                        sign-in redirect completes.
                    </p>
                </div>
            </div>

            <h2>Optional — only with your consent</h2>
            <p>These aren't required for the site to work. We only use them if you opt in.</p>

            <div className={styles.cookieGrid}>
                <div className={styles.cookieCard}>
                    <div className={styles.cookieHeader}>
                        <div>
                            <strong className={styles.serviceName}>Sentry</strong>
                            <span className={styles.serviceType}>Error monitoring</span>
                        </div>
                        <span
                            className={`${styles.statusBadge} ${consent?.analytics ? styles.statusOn : styles.statusOff}`}
                        >
                            {consent?.analytics ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                    <p className={styles.cookieDesc}>
                        Reports crashes and bugs so we can fix them. Sends your browser info and IP to Sentry only when
                        something breaks.
                    </p>
                </div>

                <div className={styles.cookieCard}>
                    <div className={styles.cookieHeader}>
                        <div>
                            <strong className={styles.serviceName}>Google Fonts</strong>
                            <span className={styles.serviceType}>Web Fonts</span>
                        </div>
                        <span
                            className={`${styles.statusBadge} ${consent?.preferences ? styles.statusOn : styles.statusOff}`}
                        >
                            {consent?.preferences ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                    <p className={styles.cookieDesc}>
                        Loads the Inter typeface. Declining just falls back to your system font — nothing breaks.
                    </p>
                </div>
            </div>

            <h2>Manage your preferences</h2>
            <p>
                Change your mind any time — this reopens the same choice you got on your first visit (Accept all /
                Necessary only / Customize). You can also withdraw consent by clearing cookies in your browser, though
                this may reset your saved preferences.
            </p>
            <div style={{ marginBottom: '32px' }}>
                <Button variant="ghost" onClick={reopen}>
                    Manage cookie preferences
                </Button>
            </div>

            <h2>More on how we handle data</h2>
            <p>
                This page covers cookies and third-party scripts specifically. For what account data we store and why,
                see our <Link to="/privacy">Privacy Policy</Link>.
            </p>

            <h2>Contact</h2>
            <p>
                Questions about cookies: <a href="mailto:support@extree.tech">support@extree.tech</a>.
            </p>
        </LegalLayout>
    );
}
