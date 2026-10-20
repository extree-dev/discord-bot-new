import { Link } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import styles from './index.module.scss';

// Вынесено из общего абзаца про куки в pages/privacy в отдельную
// страницу — тот же контент, что уже был в privacy ("How it's stored"),
// но как самостоятельный, предметный Cookie Policy документ: именно так
// его ищут (/cookies), а не как подраздел в середине privacy policy.
// Оба необходимых куки — строго технические (сессия и CSRF-state), ни
// один не требует cookie-consent баннера по GDPR (ePrivacy Directive
// исключает strictly necessary cookies из требования согласия) —
// поэтому здесь просто честная документация, а не попап с кнопками.
export function CookiesPage() {
    return (
        <div className={styles.page}>
            <SiteHeader
                rightSlot={
                    <>
                        <Link to="/terms">Terms of Use</Link>
                        <span aria-hidden="true"> · </span>
                        <Link to="/privacy">Privacy Policy</Link>
                    </>
                }
            />
            <main className={styles.main}>
                <article className={styles.article}>
                    <p className={styles.updated}>Last updated: October 20, 2026</p>
                    <h1>Cookie Policy</h1>
                    <p>
                        This page lists every cookie Extree Stats (stats.extree.tech) sets, what it&apos;s for, and how
                        long it lasts.
                    </p>

                    <h2>Cookies we use</h2>
                    <div className={styles.table}>
                        <div className={`${styles.row} ${styles.rowHead}`}>
                            <span>Name</span>
                            <span>Purpose</span>
                            <span>Duration</span>
                        </div>
                        <div className={styles.row}>
                            <code>extree_stats_session</code>
                            <span>
                                Keeps you signed in. Holds an encrypted, <code>httpOnly</code> token identifying your
                                account — it can&apos;t be read or modified from your browser.
                            </span>
                            <span>7 days, or until you sign out</span>
                        </div>
                        <div className={styles.row}>
                            <code>extree_stats_oauth_state</code>
                            <span>Prevents cross-site request forgery during Riot Sign-On (RSO) redirects.</span>
                            <span>10 minutes, or until the sign-in redirect completes</span>
                        </div>
                    </div>

                    <h2>What we don&apos;t use</h2>
                    <p>
                        No analytics cookies, no advertising cookies, and nothing that tracks you across other sites.
                        Both cookies above are strictly necessary to sign in and stay signed in — that&apos;s the only
                        reason they exist.
                    </p>

                    <h2>Your choices</h2>
                    <p>
                        Both cookies are set only once you choose to sign in or create an account — visiting the site
                        and browsing public stats sets none of them. You can clear them any time through your
                        browser&apos;s settings; doing so simply signs you out.
                    </p>

                    <h2>More on how we handle data</h2>
                    <p>
                        This page covers cookies specifically. For what account data we store and why, see our{' '}
                        <Link to="/privacy">Privacy Policy</Link>.
                    </p>

                    <h2>Changes</h2>
                    <p>
                        This policy may change if we add new cookies in the future. The date above reflects the latest
                        update.
                    </p>

                    <h2>Contact</h2>
                    <p>
                        Questions about cookies: <a href="mailto:support@extree.tech">support@extree.tech</a>.
                    </p>
                </article>
            </main>
            <footer className={styles.footer}>part of extree.tech</footer>
        </div>
    );
}
