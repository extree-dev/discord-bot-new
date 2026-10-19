import { Link } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import styles from './index.module.scss';

// Приват-полиси — отдельный обязательный пункт чеклиста Riot Developer
// Portal наравне с Terms of Use (developer.riotgames.com/policies/
// general требует оба документа у любого продукта на их API, особенно
// с OAuth-логином). Текст написан по факту того, что реально делает
// stats-backend/server.js и session.js — не шаблон: единственное, что
// сохраняется о пользователе — поле "sub" из Riot OIDC /userinfo внутри
// зашифрованной httpOnly-куки, без отдельной базы данных.
export function PrivacyPage() {
    return (
        <div className={styles.page}>
            <SiteHeader rightSlot={<Link to="/terms">Terms of Use</Link>} />
            <main className={styles.main}>
                <article className={styles.article}>
                    <p className={styles.updated}>Last updated: October 19, 2026</p>
                    <h1>Privacy Policy</h1>
                    <p>
                        This page explains what Extree Stats (stats.extree.tech) collects when you sign in with your
                        Riot account, why, and how to have it removed.
                    </p>

                    <h2>What we collect</h2>
                    <p>
                        When you sign in through Riot Sign-On (RSO), Riot sends us your account&apos;s unique identifier
                        (the <code>sub</code> claim from Riot&apos;s OpenID Connect <code>/userinfo</code> endpoint) so
                        we know which Riot account is signed in. We never see or store your Riot password —
                        authentication happens entirely on Riot&apos;s own servers.
                    </p>
                    <p>
                        We don&apos;t currently request your email address, Riot ID, or any other profile field — only
                        the account identifier needed to keep you signed in.
                    </p>

                    <h2>How it&apos;s stored</h2>
                    <p>
                        That identifier lives in a single encrypted, <code>httpOnly</code> session cookie (
                        <code>extree_stats_session</code>) — there is no user database. The cookie is encrypted with
                        AES-256-GCM and can&apos;t be read or modified from your browser. It expires automatically after
                        7 days, or immediately when you sign out.
                    </p>
                    <p>
                        A second, short-lived cookie (<code>extree_stats_oauth_state</code>) exists only during the
                        sign-in redirect itself, to prevent cross-site request forgery — it&apos;s deleted within
                        minutes either way.
                    </p>
                    <p>Neither cookie is used for analytics, advertising, or tracking across other sites.</p>

                    <h2>VALORANT match data</h2>
                    <p>
                        Once sign-in is live, match history, win rates, and rank data will be requested from the
                        official VALORANT API server-side, on demand, for the signed-in account only — not in bulk, not
                        on a schedule, and not cached beyond what&apos;s needed to render the page you asked for.
                    </p>

                    <h2>Who we share data with</h2>
                    <p>
                        We don&apos;t sell or share your data with third parties. The only outside party involved is
                        Riot Games, whose API and Sign-On service this product is built on. Extree Stats is a separate
                        product from the Extree Discord bot and its dashboard — the two don&apos;t share accounts,
                        sessions, or data.
                    </p>

                    <h2>Deleting your data</h2>
                    <p>
                        Signing out clears your session cookie immediately. Because we don&apos;t keep a database of
                        accounts, there&apos;s nothing else to delete on our end. If that changes as the product grows,
                        this page will be updated to describe how to request deletion.
                    </p>

                    <h2>Children</h2>
                    <p>
                        Extree Stats requires a Riot Games account to sign in, so it&apos;s subject to Riot&apos;s own
                        age requirements for account creation.
                    </p>

                    <h2>Changes</h2>
                    <p>
                        This policy may change as the product develops, in particular once match-data features go live.
                        The date above reflects the latest update.
                    </p>

                    <h2>Contact</h2>
                    <p>
                        Questions about your data: <a href="mailto:support@extree.tech">support@extree.tech</a>.
                    </p>
                </article>
            </main>
            <footer className={styles.footer}>part of extree.tech</footer>
        </div>
    );
}
