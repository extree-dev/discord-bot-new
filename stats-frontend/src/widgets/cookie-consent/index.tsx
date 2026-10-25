import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../shared/ui/Button';
import { useConsent } from '../../shared/consent/useConsent';
import styles from './index.module.scss';

// Показывается, пока consent === null (решение ещё не принято) — см.
// ConsentProvider. "Customize" разворачивает три категории инлайн, без
// отдельной модалки: Necessary (всегда включено, сессия/CSRF/Turnstile —
// без них сайт не работает), Analytics (Sentry) и Preferences (Google
// Fonts) — обе non-essential, по умолчанию выключены до явного согласия.
export function CookieConsentBanner() {
    const { bannerOpen, acceptAll, rejectNonEssential, savePreferences, consent } = useConsent();
    const [customizing, setCustomizing] = useState(false);
    const [analytics, setAnalytics] = useState(consent?.analytics ?? false);
    const [preferences, setPreferences] = useState(consent?.preferences ?? false);

    if (!bannerOpen) return null;

    return (
        <div className={styles.banner} role="dialog" aria-label="Cookie preferences" aria-modal="false">
            <div className={styles.inner}>
                {!customizing ? (
                    <>
                        <p className={styles.text}>
                            We use strictly necessary cookies to keep you signed in and the site secure. With your
                            consent, we&apos;d also like to use error monitoring and load the Inter typeface from Google
                            Fonts — see our <Link to="/cookies">Cookie Policy</Link> for the full breakdown.
                        </p>
                        <div className={styles.actions}>
                            <Button variant="ghost" size="sm" onClick={() => setCustomizing(true)}>
                                Customize
                            </Button>
                            <Button variant="ghost" size="sm" onClick={rejectNonEssential}>
                                Necessary only
                            </Button>
                            <Button variant="primary" size="sm" onClick={acceptAll}>
                                Accept all
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.categories}>
                            <label className={styles.category}>
                                <input type="checkbox" checked disabled aria-label="Necessary (always on)" />
                                <span>
                                    <strong>Necessary</strong>
                                    <p>
                                        Session, CSRF protection, and bot-protection (Cloudflare Turnstile) on sign-in.
                                        Always on — the site can&apos;t function without these.
                                    </p>
                                </span>
                            </label>
                            <label className={styles.category}>
                                <input
                                    type="checkbox"
                                    checked={analytics}
                                    onChange={e => setAnalytics(e.target.checked)}
                                    aria-label="Error monitoring"
                                />
                                <span>
                                    <strong>Error monitoring</strong>
                                    <p>
                                        Sentry reports crashes so we can fix them. Sends your browser info and IP to
                                        Sentry only when something breaks.
                                    </p>
                                </span>
                            </label>
                            <label className={styles.category}>
                                <input
                                    type="checkbox"
                                    checked={preferences}
                                    onChange={e => setPreferences(e.target.checked)}
                                    aria-label="Fonts"
                                />
                                <span>
                                    <strong>Fonts</strong>
                                    <p>
                                        Loads the Inter typeface from Google Fonts. Declining just falls back to your
                                        system font.
                                    </p>
                                </span>
                            </label>
                        </div>
                        <div className={styles.actions}>
                            <Button variant="ghost" size="sm" onClick={() => setCustomizing(false)}>
                                Back
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => savePreferences({ analytics, preferences })}
                            >
                                Save preferences
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
