import { Link } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import styles from './index.module.scss';

// Контент написан в том же духе, что у web/bot-site/terms.html
// (независимый проект, "as is", без SLA) — но на английском (аудитория
// этой страницы в первую очередь — ревьюеры Riot) и с разделами,
// специфичными для продукта на их API (раздел "Riot Games" и "Data we
// access" — прямое соответствие пунктам чеклиста Riot Developer Portal
// при сабмите заявки: не собираем данные игроков без RSO-логина, не
// делаем item-shop checker, не выдаём данные за real-time/esports-фид).
export function TermsPage() {
    return (
        <div className={styles.page}>
            <SiteHeader rightSlot={<Link to="/privacy">Privacy Policy</Link>} />
            <main className={styles.main}>
                <article className={styles.article}>
                    <p className={styles.updated}>Last updated: October 19, 2026</p>
                    <h1>Terms of Use</h1>
                    <p>By using Extree Stats (stats.extree.tech), you agree to the terms on this page.</p>

                    <h2>What this service is</h2>
                    <p>
                        Extree Stats is a free VALORANT statistics website — match history, win rates by map and agent,
                        and rank tracking — built on the official Riot Games VALORANT API. It's part of Extree
                        (extree.tech), the same team behind the Extree Discord moderation bot.
                    </p>

                    <h2>Riot Games</h2>
                    <p>
                        Extree Stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot
                        Games or anyone officially involved in producing or managing VALORANT. VALORANT and Riot Games
                        are trademarks or registered trademarks of Riot Games, Inc. Your use of the VALORANT API through
                        Extree Stats is also subject to Riot's own API Terms and Conditions and General Policies.
                    </p>

                    <h2>Account &amp; sign-in</h2>
                    <p>
                        Extree Stats authenticates through Riot Sign-On (RSO) — we don't collect or store your Riot
                        password, and we don't look up or display another player's match history without that player
                        having signed in themselves. This feature is still in development; sign-in isn't live yet.
                    </p>

                    <h2>Acceptable use</h2>
                    <ul>
                        <li>
                            Don't use Extree Stats to build or operate an item-shop checker, or anything else Riot's
                            policies prohibit.
                        </li>
                        <li>
                            Don't attempt to scrape, reverse-engineer, or exceed the request volume a normal player
                            session would generate.
                        </li>
                        <li>
                            Match data shown is as reported by the Riot API — it isn't real-time and isn't an esports or
                            competitive-data feed.
                        </li>
                    </ul>

                    <h2>Data we access</h2>
                    <p>
                        Requests to the VALORANT API are made server-side; the API key is never exposed to your browser.
                        We only request data tied to the Riot account that signed in, on demand — not in bulk or on a
                        schedule.
                    </p>

                    <h2>Disclaimer of warranties</h2>
                    <p>
                        Extree Stats is provided "as is", without warranties of uninterrupted availability, accuracy, or
                        fitness for a particular purpose. This is an independent project, not a commercial SLA service.
                    </p>

                    <h2>Limitation of liability</h2>
                    <p>
                        We aren't liable for losses arising from your use of, or inability to use, Extree Stats —
                        including outages of the Riot API, which are outside this project's control.
                    </p>

                    <h2>Termination</h2>
                    <p>
                        We may suspend or end access to Extree Stats for anyone who violates these terms or Riot's own
                        policies.
                    </p>

                    <h2>Changes</h2>
                    <p>
                        These terms may change as the product develops. The date above reflects the latest update —
                        continuing to use Extree Stats after a change means you accept the new terms.
                    </p>

                    <h2>Contact</h2>
                    <p>
                        Questions about these terms: <a href="mailto:support@extree.tech">support@extree.tech</a>.
                    </p>
                </article>
            </main>
            <footer className={styles.footer}>part of extree.tech</footer>
        </div>
    );
}
