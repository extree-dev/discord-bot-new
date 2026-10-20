import { Link } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import styles from './index.module.scss';

// Приват-полиси — отдельный обязательный пункт чеклиста Riot Developer
// Portal наравне с Terms of Use (developer.riotgames.com/policies/
// general требует оба документа у любого продукта на их API, особенно
// с OAuth-логином). Текст написан по факту того, что реально делает
// stats-backend/ — не шаблон, и обновлён вместе с добавлением
// email+пароль-аккаунтов (см. stats-backend/users.js/db.js): теперь это
// больше не "нет базы данных", честность важнее, чем звучать проще.
export function PrivacyPage() {
    return (
        <div className={styles.page}>
            <SiteHeader
                rightSlot={
                    <>
                        <Link to="/terms">Terms of Use</Link>
                        <span aria-hidden="true"> · </span>
                        <Link to="/cookies">Cookie Policy</Link>
                    </>
                }
            />
            <main className={styles.main}>
                <article className={styles.article}>
                    <p className={styles.updated}>Last updated: October 20, 2026</p>
                    <h1>Privacy Policy</h1>
                    <p>
                        This page explains what Extree Stats (stats.extree.tech) collects, whether you sign in with
                        email or with your Riot account, why, and how to have it removed.
                    </p>

                    <h2>Email + password accounts</h2>
                    <p>
                        If you create an account, we store your email address and a hashed password (never the password
                        itself — it&apos;s hashed with scrypt and can&apos;t be reversed) in our database. During
                        sign-up, we email a 6-digit code to confirm the address is really yours; that code is deleted
                        once used or after 10 minutes, whichever comes first.
                    </p>
                    <p>
                        Verification emails are sent from a mailbox dedicated to Extree Stats, separate from the rest of
                        the extree.tech infrastructure.
                    </p>

                    <h2>Signing in with Riot (RSO)</h2>
                    <p>
                        When you sign in through Riot Sign-On, Riot sends us your account&apos;s unique identifier (the{' '}
                        <code>sub</code> claim from Riot&apos;s OpenID Connect <code>/userinfo</code> endpoint) so we
                        know which Riot account is signed in. We never see or store your Riot password — authentication
                        happens entirely on Riot&apos;s own servers. Linking a Riot account to your Extree Stats account
                        is planned but not available yet — per Riot&apos;s own policies, linking it will require
                        accepting a separate, explicit notice that doing so makes your VALORANT stats visible to other
                        Extree Stats users who look you up. We won&apos;t show match data for any Riot account that
                        hasn&apos;t opted in that way itself.
                    </p>

                    <h2>How it&apos;s stored</h2>
                    <p>
                        Account data (email, hashed password, and — once linked — your Riot identifier) lives in our
                        database. Your signed-in session itself is a single encrypted, <code>httpOnly</code> cookie (
                        <code>extree_stats_session</code>), not a server-side session store — it&apos;s encrypted with
                        AES-256-GCM, can&apos;t be read or modified from your browser, and expires automatically after 7
                        days or immediately when you sign out.
                    </p>
                    <p>
                        A second, short-lived cookie (<code>extree_stats_oauth_state</code>) exists only during the Riot
                        sign-in redirect itself, to prevent cross-site request forgery — it&apos;s deleted within
                        minutes either way.
                    </p>
                    <p>
                        None of these cookies are used for analytics, advertising, or tracking across other sites. See
                        our <Link to="/cookies">Cookie Policy</Link> for the full list, including exact durations.
                    </p>

                    <h2>Sign-in security (IP address &amp; location)</h2>
                    <p>
                        When you sign in, we look up the approximate country (and sometimes city) your IP address
                        belongs to, using a local, offline database on our own server — no third-party geolocation
                        service is called, and your IP address is never sent anywhere outside our infrastructure. We
                        keep the country tied to your account so we can recognize future sign-ins from the same place.
                    </p>
                    <p>
                        Signing in from a country we haven&apos;t seen for your account before requires confirming a
                        one-time code we email you, the same way as during sign-up. After every successful sign-in, we
                        also email you a notification with the approximate time, location, and IP address, so you can
                        tell if it wasn&apos;t you.
                    </p>
                    <p>
                        We don&apos;t keep a full history of every IP address you&apos;ve ever signed in from — only the
                        countries we currently recognize for your account.
                    </p>

                    <h2>VALORANT match data</h2>
                    <p>
                        Once Riot account linking and match history are live, that data will be requested from the
                        official VALORANT API server-side, on demand, for your account only — not in bulk, not on a
                        schedule, and not cached beyond what&apos;s needed to render the page you asked for.
                    </p>

                    <h2>Who we share data with</h2>
                    <p>
                        We don&apos;t sell or share your data with third parties. The outside parties involved are Riot
                        Games (whose API and Sign-On service this product is built on) and our email provider (used only
                        to deliver verification codes to the address you give us). Extree Stats is a separate product
                        from the Extree Discord bot and its dashboard — the two don&apos;t share accounts, sessions, or
                        data.
                    </p>

                    <h2>Deleting your data</h2>
                    <p>
                        Signing out clears your session cookie immediately. To delete your account and the data tied to
                        it, email us — we don&apos;t have self-serve deletion yet, but we&apos;ll remove it by hand on
                        request.
                    </p>

                    <h2>Children</h2>
                    <p>
                        Extree Stats isn&apos;t directed at children. If you link a Riot account, that&apos;s also
                        subject to Riot&apos;s own age requirements for account creation.
                    </p>

                    <h2>Changes</h2>
                    <p>
                        This policy may change as the product develops, in particular once Riot account linking and
                        match-data features go live. The date above reflects the latest update.
                    </p>

                    <h2>Contact</h2>
                    <p>
                        Questions about your data, or to request deletion:{' '}
                        <a href="mailto:support@extree.tech">support@extree.tech</a>.
                    </p>
                </article>
            </main>
            <footer className={styles.footer}>part of extree.tech</footer>
        </div>
    );
}
