import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { TextArea } from '../../shared/ui/TextArea';
import { Select } from '../../shared/ui/Select';
import { Button } from '../../shared/ui/Button';
import { submitSupportTicket, getAccount, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const CATEGORIES = [
    { value: 'account', label: 'Account & login' },
    { value: 'bug', label: 'Bug report' },
    { value: 'billing', label: 'Billing' },
    { value: 'other', label: 'Other' },
];

const FAQ = [
    {
        q: 'How do I reset my password?',
        a: (
            <>
                Use the{' '}
                <Link to="/forgot-password" target="_blank" rel="noreferrer">
                    forgot password
                </Link>{' '}
                link on the sign-in page — we&apos;ll email you a link to set a new one. No need to open a ticket.
            </>
        ),
    },
    {
        q: 'How do I delete my account?',
        a: 'Send us a message below with the "Account & login" category — we don\'t have self-serve deletion yet, so we remove your account and data by hand on request.',
    },
    {
        q: 'Why was I asked for a code when signing in?',
        a: "We ask for a one-time code the first time you sign in from a country we haven't seen on your account before — it's a safeguard against someone else using your password.",
    },
];

function FaqItem({ q, a }: { q: string; a: ReactNode }) {
    const [open, setOpen] = useState(false);
    return (
        <div className={styles.faqItem}>
            <button type="button" className={styles.faqQuestion} aria-expanded={open} onClick={() => setOpen(o => !o)}>
                {q}
                <span
                    className={open ? `${styles.faqIcon} ${styles.faqIconOpen}` : styles.faqIcon}
                    aria-hidden="true"
                />
            </button>
            <div className={open ? `${styles.faqAnswer} ${styles.faqAnswerOpen}` : styles.faqAnswer}>
                <div className={styles.faqAnswerInner}>
                    <p>{a}</p>
                </div>
            </div>
        </div>
    );
}

export function SupportPage() {
    const [accountEmail, setAccountEmail] = useState<string | null>(null);
    const [checkingAccount, setCheckingAccount] = useState(true);
    const [email, setEmail] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0].value);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [ticketNumber, setTicketNumber] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        getAccount().then(user => {
            if (cancelled) return;
            setAccountEmail(user?.email ?? null);
            setCheckingAccount(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            const result = await submitSupportTicket(subject, message, category, accountEmail ? undefined : email);
            setTicketNumber(result.ticketNumber);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    return (
        <SplitAuthLayout
            badge="We're here to help"
            heading={
                <>
                    Get in
                    <br />
                    <span className="hl">touch.</span>
                </>
            }
            lead="Found a bug, have a question about your account, or something not working right? Send us a message — we read every one."
            leftExtra={
                <div className={styles.faq}>
                    <h2 className={styles.faqTitle}>Common questions</h2>
                    {FAQ.map(item => (
                        <FaqItem key={item.q} q={item.q} a={item.a} />
                    ))}
                </div>
            }
            cardTitle="Contact support"
            error={error}
            footer={
                <>
                    Looking for something else? <Link to="/">Back to Extree Stats</Link>
                </>
            }
        >
            {ticketNumber ? (
                <div className={styles.sent}>
                    <p>
                        Thanks — we got your message. We&apos;ll reply to <strong>{accountEmail ?? email}</strong> as
                        soon as we can.
                    </p>
                    <div className={styles.ticketId}>
                        Ticket <code>#{ticketNumber}</code>
                    </div>
                </div>
            ) : (
                <form className={styles.form} onSubmit={onSubmit}>
                    <p className={styles.responseTime}>We usually reply within 24 hours.</p>
                    {!checkingAccount && accountEmail && (
                        <p className={styles.accountEmail}>
                            We&apos;ll use your account email: <strong>{accountEmail}</strong>
                        </p>
                    )}
                    {!checkingAccount && !accountEmail && (
                        <TextField
                            id="email"
                            label="Email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    )}
                    <Select options={CATEGORIES} value={category} onChange={setCategory} />
                    <TextField
                        id="subject"
                        label="Subject"
                        type="text"
                        required
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                    />
                    <TextArea
                        id="message"
                        label="Message"
                        required
                        maxLength={5000}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                    />
                    <Button type="submit" variant="flat" fullWidth disabled={pending || checkingAccount}>
                        {pending ? 'Sending…' : 'Send message'}
                    </Button>
                </form>
            )}
        </SplitAuthLayout>
    );
}
