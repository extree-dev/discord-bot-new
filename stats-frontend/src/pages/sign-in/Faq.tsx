import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Faq.module.scss';

interface FaqItem {
    question: string;
    answer: ReactNode;
}

// Статус RSO (Riot Sign-On) честно объясняется только здесь и на странице
// входа — не на первом экране лендинга, чтобы не превращать hero в
// предупреждение (см. ТЗ, раздел 9 "Статус RSO"). Формулировка нейтральная,
// без драматизации.
const FAQ_ITEMS: FaqItem[] = [
    {
        question: 'Is signing in with Riot safe?',
        answer: 'Yes. Sign-in uses Riot Sign-On (RSO) — an official OAuth flow. We never see or store your Riot password; Riot only hands us a token that lets us read your match history.',
    },
    {
        question: 'When will Riot sign-in be available?',
        answer: "Our integration with Riot's API is still in review — RSO access is granted separately, after that review completes. Email sign-in works today, and the dashboard switches on real data the moment RSO is approved.",
    },
    {
        question: 'What data do you store?',
        answer: (
            <>
                Just your account email and the match stats Riot's API returns for your account — maps, agents, K/D,
                and rank history. See our{' '}
                <Link to="/privacy" className={styles.inlineLink}>
                    Privacy Policy
                </Link>{' '}
                for the full breakdown.
            </>
        ),
    },
    {
        question: 'Is it free?',
        answer: 'Yes, Extree Stats is free to use. There is no paid tier right now.',
    },
    {
        question: 'Do I need to install anything?',
        answer: "No. It's a website — sign in from any browser, desktop or mobile, nothing to download.",
    },
    {
        question: 'How is this different from other trackers?',
        answer: 'No ads, no paywalled stats, and no screen-scraping — just your real match data from Riot, read-only, shown the way you would actually want to read it.',
    },
];

export function Faq() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <div className={styles.list}>
            {FAQ_ITEMS.map((item, index) => {
                const isOpen = openIndex === index;
                const panelId = `faq-panel-${index}`;
                const headerId = `faq-header-${index}`;

                return (
                    <div key={item.question} className={styles.item}>
                        <h3 className={styles.itemHeading}>
                            <button
                                type="button"
                                id={headerId}
                                className={styles.trigger}
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                onClick={() => setOpenIndex(isOpen ? null : index)}
                            >
                                <span>{item.question}</span>
                                <span className={styles.sign} aria-hidden="true">
                                    {isOpen ? '−' : '+'}
                                </span>
                            </button>
                        </h3>
                        <div
                            id={panelId}
                            role="region"
                            aria-labelledby={headerId}
                            className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
                        >
                            <p className={styles.answer}>{item.answer}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
