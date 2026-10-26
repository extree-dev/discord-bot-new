import { Link } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import { Button } from '../../shared/ui/Button';
import { useConsent } from '../../shared/consent/useConsent';
import styles from './index.module.scss';

// Вынесено из общего абзаца про куки в pages/privacy в отдельную
// страницу — тот же контент, что уже был в privacy ("How it's stored"),
// но как самостоятельный, предметный Cookie Policy документ: именно так
// его ищут (/cookies), а не как подраздел в середине privacy policy.
//
// Три необходимых куки (сессия, CSRF-токен, Turnstile) — строго
// технические, ни одна не требует согласия по GDPR/ePrivacy (strictly
// necessary исключены из требования consent). Но мы также используем два
// non-essential сторонних сервиса (Sentry, Google Fonts) — вот под них и
// нужен баннер (widgets/cookie-consent) и управление категориями ниже.
export function CookiesPage() {
    const { consent, reopen } = useConsent();

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
                    <p className={styles.updated}>Last updated: October 25, 2026</p>
                    <h1>Cookie Policy</h1>
                    <p>
                        This page lists every cookie and third-party service Extree Stats (stats.extree.tech) uses, what
                        each is for, and how long it lasts.
                    </p>

                    <h2>Necessary — always on</h2>
                    <p>
                        These keep the site working and secure. They&apos;re strictly necessary under GDPR/ePrivacy, so
                        they don&apos;t require consent and can&apos;t be turned off.
                    </p>
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
                            <code>csrf</code>
                            <span>Prevents cross-site request forgery on forms and account actions.</span>
                            <span>2 hours</span>
                        </div>
                        <div className={styles.row}>
                            <code>extree_stats_oauth_state</code>
                            <span>Prevents cross-site request forgery during Riot Sign-On (RSO) redirects.</span>
                            <span>10 minutes, or until the sign-in redirect completes</span>
                        </div>
                        <div className={styles.row}>
                            <code>cf_*</code>
                            <span>
                                Set by Cloudflare Turnstile, the bot-check widget on the sign-in and registration forms.
                                We don&apos;t control these directly — see{' '}
                                <a href="https://www.cloudflare.com/cookie-policy/" target="_blank" rel="noreferrer">
                                    Cloudflare&apos;s cookie policy
                                </a>
                                .
                            </span>
                            <span>Varies (Cloudflare-managed)</span>
                        </div>
                    </div>

                    <h2>Optional — only with your consent</h2>
                    <p>These aren&apos;t required for the site to work. We only use them if you opt in.</p>
                    <div className={styles.table}>
                        <div className={`${styles.row} ${styles.rowHead}`}>
                            <span>Service</span>
                            <span>Purpose</span>
                            <span>Status</span>
                        </div>
                        <div className={styles.row}>
                            <code>Sentry</code>
                            <span>
                                Error monitoring — reports crashes and bugs so we can fix them. Sends your browser info
                                and IP to Sentry only when something breaks.
                            </span>
                            <span>{consent?.analytics ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <div className={styles.row}>
                            <code>Google Fonts</code>
                            <span>
                                Loads the Inter typeface. Declining just falls back to your system font — nothing
                                breaks.
                            </span>
                            <span>{consent?.preferences ? 'Enabled' : 'Disabled'}</span>
                        </div>
                    </div>

                    <h2>Manage your preferences</h2>
                    <p>
                        Change your mind any time — this reopens the same choice you got on your first visit (Accept all
                        / Necessary only / Customize).
                    </p>
                    <Button variant="ghost" size="sm" onClick={reopen}>
                        Manage cookie preferences
                    </Button>

                    <h2>More on how we handle data</h2>
                    <p>
                        This page covers cookies and third-party scripts specifically. For what account data we store
                        and why, see our <Link to="/privacy">Privacy Policy</Link>.
                    </p>

                    <h2>Changes</h2>
                    <p>
                        This policy may change if we add new cookies or services in the future. The date above reflects
                        the latest update.
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
