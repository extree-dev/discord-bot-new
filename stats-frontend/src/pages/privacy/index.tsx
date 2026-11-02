import { Link } from 'react-router-dom';
import { LegalLayout } from '../../shared/ui/LegalLayout';

export function PrivacyPage() {
    return (
        <LegalLayout title="Privacy Policy" lastUpdated="October 29, 2026">
            <p>
                This page explains what Extree Stats (stats.extree.tech) collects, whether you sign in with email or
                with your Riot account, why, and how to have it removed.
            </p>

            <h2>Email + password accounts</h2>
            <p>
                If you create an account, we store your email address and a hashed password (never the password itself —
                it's hashed with scrypt and can't be reversed) in our database. During sign-up, we email a 6-digit code
                to confirm the address is really yours; that code is deleted once used or after 10 minutes, whichever
                comes first.
            </p>
            <p>
                Verification emails are sent from a mailbox dedicated to Extree Stats, separate from the rest of the
                extree.tech infrastructure.
            </p>

            <h2>Signing in with Riot (RSO)</h2>
            <p>
                When you sign in through Riot Sign-On, Riot sends us your account's unique identifier (the{' '}
                <code>sub</code> claim from Riot's OpenID Connect <code>/userinfo</code> endpoint) so we know which Riot
                account is signed in. We never see or store your Riot password — authentication happens entirely on
                Riot's own servers. Linking a Riot account to your Extree Stats account is planned but not available yet
                — per Riot's own policies, linking it will require accepting a separate, explicit notice that doing so
                makes your VALORANT stats visible to other Extree Stats users who look you up. We won't show match data
                for any Riot account that hasn't opted in that way itself.
            </p>

            <h2>How it's stored</h2>
            <p>
                Account data (email, hashed password, and — once linked — your Riot identifier) lives in our database.
                Your signed-in session itself is a single encrypted, <code>httpOnly</code> cookie (
                <code>extree_stats_session</code>), not a server-side session store — it's encrypted with AES-256-GCM,
                can't be read or modified from your browser, and expires automatically after 7 days or immediately when
                you sign out.
            </p>
            <p>
                A second, short-lived cookie (<code>extree_stats_oauth_state</code>) exists only during the Riot sign-in
                redirect itself, to prevent cross-site request forgery — it's deleted within minutes either way. A third
                (<code>csrf</code>) protects form submissions the same way, for up to 2 hours.
            </p>
            <p>
                None of these cookies are used for analytics, advertising, or tracking across other sites. We do use two
                optional, non-essential services (error monitoring and web fonts) — both off by default until you
                consent. See our <Link to="/cookies">Cookie Policy</Link> for the full list, exact durations, and how to
                change your choice.
            </p>

            <h2>Sign-in security (IP address &amp; location)</h2>
            <p>
                When you sign in, we look up the approximate country (and sometimes city) your IP address belongs to,
                using a local, offline database on our own server — no third-party geolocation service is called, and
                your IP address is never sent anywhere outside our infrastructure. We keep the country tied to your
                account so we can recognize future sign-ins from the same place.
            </p>
            <p>
                Signing in from a country we haven't seen for your account before requires confirming a one-time code we
                email you, the same way as during sign-up. After every successful sign-in, we also email you a
                notification with the approximate time, location, and IP address, so you can tell if it wasn't you.
            </p>
            <p>
                We don't keep a full history of every IP address you've ever signed in from — only the countries we
                currently recognize for your account.
            </p>

            <h2>VALORANT match data</h2>
            <p>
                Once Riot account linking and match history are live, that data will be requested from the official
                VALORANT API server-side, on demand, for your account only — not in bulk, not on a schedule, and not
                cached beyond what's needed to render the page you asked for.
            </p>

            <h2>Who we share data with</h2>
            <p>
                We don't sell or share your data with third parties. The outside parties involved are Riot Games (whose
                API and Sign-On service this product is built on) and our email provider (used only to deliver
                verification codes to the address you give us). Extree Stats is a separate product from the Extree
                Discord bot and its dashboard — the two don't share accounts, sessions, or data.
            </p>

            <h2>International Data Transfers</h2>
            <p>
                If you are located in the European Economic Area (EEA), the United Kingdom, or Switzerland, please note
                that your data may be transferred to and processed in countries outside of your jurisdiction where data
                protection laws may differ. We take appropriate safeguards to ensure your data remains protected in
                accordance with this policy.
            </p>

            <h2>Your Rights</h2>
            <p>
                Depending on where you live, you may have the right to access, correct, or delete the personal data we
                hold about you. To exercise any of these rights, contact us at{' '}
                <a href="mailto:support@extree.tech">support@extree.tech</a>. We will respond within a reasonable
                timeframe.
            </p>
            <p>
                You can also delete your account at any time through the Account Settings page or by emailing us. We do
                not retain personal data longer than necessary for the purposes described in this policy.
            </p>

            <h2>Children</h2>
            <p>
                Extree Stats isn't directed at children. If you link a Riot account, that's also subject to Riot's own
                age requirements for account creation.
            </p>

            <h2>Changes</h2>
            <p>
                This policy may change as the product develops, in particular once Riot account linking and match-data
                features go live. The date above reflects the latest update.
            </p>

            <h2>Contact</h2>
            <p>
                Questions about your data, or to request deletion:{' '}
                <a href="mailto:support@extree.tech">support@extree.tech</a>.
            </p>
        </LegalLayout>
    );
}
