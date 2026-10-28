import { Link } from 'react-router-dom';
import { SiteHeader } from '../../widgets/site-header';
import { RiotSignInButton } from '../../features/riot-sign-in/RiotSignInButton';
import { Button } from '../../shared/ui/Button';
import { TargetIcon, TrendUpIcon, TrophyIcon, HistoryIcon } from '../../shared/ui/Icons';
import { Faq } from './Faq';
import styles from './index.module.scss';

const RIOT_DISCLAIMER =
    "Extree Stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing VALORANT. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc.";

const NAV_LINKS = [
    { label: 'Features', href: '#features' },
    { label: 'FAQ', href: '#faq' },
];

export function SignInPage() {
    return (
        <div className={styles.page}>
            <div className={styles.ambient} aria-hidden="true" />
            <SiteHeader navLinks={NAV_LINKS} />

            <main>
                <section className={styles.hero}>
                    <div className={styles.gridBg} aria-hidden="true" />
                    <div className={styles.heroGlow} aria-hidden="true" />

                    <div className={styles.heroContent}>
                        <h1 className={styles.title}>
                            Every match, <br className={styles.brDesktop} />
                            <span className={styles.gradientText}>broken down</span>.
                        </h1>
                        <p className={styles.lead}>
                            Win rates by map and agent, K/D trends, and rank progress. All in one dashboard.
                        </p>
                        <div className={styles.ctaGroup}>
                            <RiotSignInButton />
                            <Button variant="secondary" href="#features">
                                View features
                            </Button>
                        </div>
                        <p className={styles.altAuth}>
                            Prefer email? <Link to="/register">Create an account</Link>
                        </p>
                    </div>

                    <div className={styles.heroShowcase}>
                        <div className={styles.showcaseHeader}>
                            <div className={styles.showcaseTitle}>Match Analysis</div>
                            <div className={styles.showcaseBadge}>LIVE PREVIEW</div>
                        </div>
                        <div className={styles.showcaseBody}>
                            <div className={styles.showcaseChart}>
                                <svg viewBox="0 0 400 100" className={styles.sparkline} preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                                            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        d="M0,80 Q50,70 100,40 T200,50 T300,20 T400,10 L400,100 L0,100 Z"
                                        fill="url(#chartGrad)"
                                    />
                                    <path
                                        d="M0,80 Q50,70 100,40 T200,50 T300,20 T400,10"
                                        fill="none"
                                        stroke="var(--accent)"
                                        strokeWidth="2"
                                    />
                                </svg>
                            </div>
                            <div className={styles.showcaseStats}>
                                <div className={styles.statRow}>
                                    <span>Win Rate</span>
                                    <strong>64.2%</strong>
                                </div>
                                <div className={styles.statRow}>
                                    <span>K/D Ratio</span>
                                    <strong>1.42</strong>
                                </div>
                                <div className={styles.statRow}>
                                    <span>Headshot %</span>
                                    <strong>28.5%</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="features" className={styles.features} data-reveal>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Everything you need to improve.</h2>
                        <p className={styles.sectionSubtitle}>Built for players who want to see the bigger picture.</p>
                    </div>
                    <div className={styles.featuresGrid}>
                        <div className={styles.featureCard} data-reveal>
                            <div className={styles.featureIconWrap}>
                                <TargetIcon />
                            </div>
                            <h3 className={styles.featureTitle}>Win rates by map & agent</h3>
                            <p className={styles.featureBody}>
                                See exactly where you&apos;re strong — and where you&apos;re not.
                            </p>
                        </div>
                        <div className={styles.featureCard} data-reveal>
                            <div className={styles.featureIconWrap}>
                                <TrendUpIcon />
                            </div>
                            <h3 className={styles.featureTitle}>K/D trends</h3>
                            <p className={styles.featureBody}>
                                Momentum over time, not just one lucky — or unlucky — match.
                            </p>
                        </div>
                        <div className={styles.featureCard} data-reveal>
                            <div className={styles.featureIconWrap}>
                                <TrophyIcon />
                            </div>
                            <h3 className={styles.featureTitle}>Rank progress</h3>
                            <p className={styles.featureBody}>
                                How far you are from the next rank, and what&apos;s holding you back.
                            </p>
                        </div>
                        <div className={styles.featureCard} data-reveal>
                            <div className={styles.featureIconWrap}>
                                <HistoryIcon />
                            </div>
                            <h3 className={styles.featureTitle}>Match history</h3>
                            <p className={styles.featureBody}>Every match broken down round by round.</p>
                        </div>
                    </div>
                </section>

                <section className={styles.howItWorks} data-reveal>
                    <h2 className={styles.sectionTitle2}>How it works</h2>
                    <div className={styles.steps}>
                        <div className={styles.step} data-reveal>
                            <span className={styles.stepNumber}>1</span>
                            <div className={styles.stepBody}>
                                <h3 className={styles.stepTitle}>Sign in with Riot</h3>
                                <p className={styles.stepText}>Secure OAuth sign-in — we never see your password.</p>
                            </div>
                            <span className={styles.stepLine} aria-hidden="true" />
                        </div>
                        <div className={styles.step} data-reveal>
                            <span className={styles.stepNumber}>2</span>
                            <div className={styles.stepBody}>
                                <h3 className={styles.stepTitle}>We pull your matches</h3>
                                <p className={styles.stepText}>
                                    Your match history and stats, straight from your own Riot account.
                                </p>
                            </div>
                            <span className={styles.stepLine} aria-hidden="true" />
                        </div>
                        <div className={styles.step} data-reveal>
                            <span className={styles.stepNumber}>3</span>
                            <div className={styles.stepBody}>
                                <h3 className={styles.stepTitle}>See your dashboard</h3>
                                <p className={styles.stepText}>Filter by map, agent, or time period.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.tagline} data-reveal>
                    <p>Made by players, for players.</p>
                </section>

                <section id="faq" className={styles.faqSection} data-reveal>
                    <h2 className={styles.sectionTitle2}>Frequently asked questions</h2>
                    <Faq />
                </section>

                <section className={styles.finalCta} data-reveal>
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
