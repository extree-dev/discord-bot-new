import { LegalLayout } from '../../shared/ui/LegalLayout';

export function TermsPage() {
    return (
        <LegalLayout title="Terms of Use" lastUpdated="October 29, 2026">
            <div
                style={{
                    background: 'var(--surface-2)',
                    borderLeft: '3px solid var(--accent)',
                    padding: '16px 20px',
                    borderRadius: '0 8px 8px 0',
                    marginBottom: '32px',
                }}
            >
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>
                    Extree Stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or
                    anyone officially involved in producing or managing Riot Games properties. Riot Games, and all
                    associated properties are trademarks or registered trademarks of Riot Games, Inc.
                </p>
            </div>

            <p>By using Extree Stats (stats.extree.tech), you agree to the terms on this page.</p>

            <h2>What this service is</h2>
            <p>
                Extree Stats is a free statistics website — match history, win rates by map and agent, and rank tracking
                — built on the official Riot Games VALORANT API. It's part of Extree (extree.tech), the same team behind
                the Extree Discord moderation bot.
            </p>

            <h2>Riot Games API</h2>
            <p>
                Your use of the VALORANT API through Extree Stats is also subject to Riot's own API Terms and Conditions
                and General Policies. Extree Stats{' '}
                <strong>does not compute an alternative ranking, MMR, or ELO system of its own</strong> — all rank data
                shown is Riot's official ranked ladder.
            </p>

            <h2>Account &amp; sign-in</h2>
            <p>
                You can create an Extree Stats account with an email and password, confirmed by a one-time code sent to
                that email. Linking a Riot account to it (via Riot Sign-On, RSO) is planned but not available yet — once
                it is, we won't collect or store your Riot password, and we won't look up or display another player's
                match history without that player having signed in themselves. Linking will require accepting a
                separate, clear notice that doing so makes your match stats visible to other Extree Stats users who look
                you up — we only show data for Riot accounts that have opted in that way themselves.
            </p>
            <p>
                Keep your password to yourself and use one account per person — don't share logins or create accounts on
                someone else's behalf.
            </p>

            <h2>Acceptable use</h2>
            <ul>
                <li>
                    Don't use Extree Stats to build or operate an item-shop checker, cheating tools, or anything else
                    Riot's policies prohibit.
                </li>
                <li>
                    Rank progress shown here is always Riot's own official rank — Extree Stats doesn't compute an
                    alternative ranking, MMR, or ELO system of its own.
                </li>
                <li>
                    Don't attempt to identify or de-anonymize a player the game itself keeps hidden, including anyone
                    who hasn't linked their Riot account to Extree Stats.
                </li>
                <li>
                    Don't attempt to scrape, reverse-engineer, or exceed the request volume a normal player session
                    would generate.
                </li>
                <li>
                    Match data shown is as reported by the Riot API — it isn't real-time and isn't an esports or
                    competitive-data feed.
                </li>
            </ul>

            <h2>Data we access</h2>
            <p>
                Requests to the VALORANT API are made server-side; the API key is never exposed to your browser. We only
                request data tied to the Riot account that signed in, on demand — not in bulk or on a schedule.
            </p>

            <h2>Disclaimer of warranties</h2>
            <p>
                Extree Stats is provided "as is", without warranties of uninterrupted availability, accuracy, or fitness
                for a particular purpose. This is an independent project, not a commercial SLA service.
            </p>

            <h2>Limitation of liability</h2>
            <p>
                We aren't liable for losses arising from your use of, or inability to use, Extree Stats — including
                outages of the Riot API, which are outside this project's control.
            </p>

            <h2>Termination</h2>
            <p>
                We may suspend or end access to Extree Stats for anyone who violates these terms or Riot's own policies.
            </p>

            <h2>Changes</h2>
            <p>
                These terms may change as the product develops. The date above reflects the latest update — continuing
                to use Extree Stats after a change means you accept the new terms.
            </p>

            <h2>Contact</h2>
            <p>
                Questions about these terms: <a href="mailto:support@extree.tech">support@extree.tech</a>.
            </p>
        </LegalLayout>
    );
}
