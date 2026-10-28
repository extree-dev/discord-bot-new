import { Link } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import { DemoDashboard } from '../../widgets/demo-dashboard';
import { RiotSignInButton } from '../../features/riot-sign-in/RiotSignInButton';
import { Button } from '../../shared/ui/Button';
import { TargetIcon, TrendUpIcon, TrophyIcon, HistoryIcon } from '../../shared/ui/Icons';
import { Faq } from './Faq';
import styles from './index.module.scss';

// Дисклеймер — обязательный пункт политик Riot Developer Portal
// (developer.riotgames.com/policies/general). Раньше жил в hero —
// перенесён в футер: по ТЗ первый экран должен за 3 секунды продавать
// продукт, а не показывать юридическую плашку про Riot.
const RIOT_DISCLAIMER =
    "Extree Stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing VALORANT. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc.";

const NAV_LINKS = [
    { label: 'Features', href: '#features' },
    { label: 'FAQ', href: '#faq' },
];

const FEATURES = [
    {
        icon: TargetIcon,
        title: 'Win rates by map & agent',
        body: "See exactly where you're strong — and where you're not.",
    },
    {
        icon: TrendUpIcon,
        title: 'K/D trends',
        body: 'Momentum over time, not just one lucky — or unlucky — match.',
    },
    {
        icon: TrophyIcon,
        title: 'Rank progress',
        body: "How far you are from the next rank, and what's holding you back.",
    },
    {
        icon: HistoryIcon,
        title: 'Match history',
        body: 'Every match broken down round by round.',
    },
];

const STEPS = [
    {
        title: 'Sign in with Riot',
        body: 'Secure OAuth sign-in — we never see your password.',
    },
    {
        title: 'We pull your matches',
        body: 'Your match history and stats, straight from your own Riot account.',
    },
    {
        title: 'See your dashboard',
        body: 'Filter by map, agent, or time period.',
    },
];

export function SignInPage() {
    return (
        <div className={styles.page}>
            <div className={styles.ambient} aria-hidden="true" />
            <SiteHeader navLinks={NAV_LINKS} />

            <main>
                <section className={styles.hero}>
                    <div className={styles.heroText}>
                        <h1 className={styles.title}>
                            Every match, <span className={styles.accentText}>broken down</span> the way you&apos;d
                            actually read it.
                        </h1>
                        <p className={styles.lead}>
                            Win rates by map and agent, K/D trends, and rank progress — all in one dashboard.
                        </p>
                        <div className={styles.ctaGroup}>
                            <RiotSignInButton />
                            <Button variant="secondary" href="#demo-dashboard">
                                View demo
                            </Button>
                        </div>
                        <p className={styles.altAuth}>
                            Prefer email? <Link to="/register">Create an account</Link>
                        </p>
                        <p className={styles.trustLine}>Free · No install · Your data only</p>
                    </div>
                    <DemoDashboard />
                </section>

                <section id="features" className={styles.features}>
                    <div className={styles.featuresGrid}>
                        {FEATURES.map(feature => {
                            const Icon = feature.icon;
                            return (
                                <div key={feature.title} className={styles.featureCard}>
                                    <span className={styles.featureIcon}>
                                        <Icon />
                                    </span>
                                    <h3 className={styles.featureTitle}>{feature.title}</h3>
                                    <p className={styles.featureBody}>{feature.body}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className={styles.howItWorks}>
                    <h2 className={styles.sectionTitle}>How it works</h2>
                    <div className={styles.steps}>
                        {STEPS.map((step, index) => (
                            <div key={step.title} className={styles.step}>
                                <span className={styles.stepNumber}>{index + 1}</span>
                                <div className={styles.stepBody}>
                                    <h3 className={styles.stepTitle}>{step.title}</h3>
                                    <p className={styles.stepText}>{step.body}</p>
                                </div>
                                {index < STEPS.length - 1 && <span className={styles.stepLine} aria-hidden="true" />}
                            </div>
                        ))}
                    </div>
                </section>

                <section className={styles.tagline}>
                    <p>Made by players, for players.</p>
                </section>

                <section id="faq" className={styles.faqSection}>
                    <h2 className={styles.sectionTitle}>Frequently asked questions</h2>
                    <Faq />
                </section>

                <section className={styles.finalCta}>
                    <h2 className={styles.finalCtaTitle}>Ready to see your own numbers?</h2>
                    <RiotSignInButton noteId="riot-sign-in-note-final" />
                </section>
            </main>

            <footer className={styles.footer}>
                <div className={styles.footerLinks}>
                    <a href="#features">Features</a>
                    <a href="#faq">FAQ</a>
                    <Link to="/support">Support</Link>
                    <Link to="/privacy">Privacy Policy</Link>
                    <Link to="/terms">Terms of Use</Link>
                    <Link to="/cookies">Cookie Policy</Link>
                </div>
                <p className={styles.disclaimer}>{RIOT_DISCLAIMER}</p>
                <p className={styles.copyright}>© {new Date().getFullYear()} Extree Stats</p>
            </footer>
        </div>
    );
}
