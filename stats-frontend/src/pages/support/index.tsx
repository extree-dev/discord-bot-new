import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { TextArea } from '../../shared/ui/TextArea';
import { Select } from '../../shared/ui/Select';
import { Button } from '../../shared/ui/Button';
import { submitSupportTicket, getAccount, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

// Категории — те же ключи, что stats-backend/validation.js
// (SUPPORT_CATEGORIES), значения синхронизированы вручную на обеих
// сторонах (отдельного shared-пакета между frontend/backend в проекте нет).
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

// Доступна и без входа (см. обсуждение) — залогиненному пользователю email
// берём из аккаунта и не даём редактировать (бэкенд игнорировал бы
// присланный, но меньше путаницы показать это явно), без сессии просят
// ввести email в форме.
export function SupportPage() {
    const [accountEmail, setAccountEmail] = useState<string | null>(null);
    const [checkingAccount, setCheckingAccount] = useState(true);
    const [email, setEmail] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0].value);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [ticketId, setTicketId] = useState<string | null>(null);

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
            setTicketId(result.ticketId);
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
                        <details key={item.q} className={styles.faqItem}>
                            <summary>{item.q}</summary>
                            <p>{item.a}</p>
                        </details>
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
            {ticketId ? (
                <div className={styles.sent}>
                    <p>
                        Thanks — we got your message. We&apos;ll reply to <strong>{accountEmail ?? email}</strong> as
                        soon as we can.
                    </p>
                    <div className={styles.ticketId}>
                        Ticket <code>{ticketId}</code>
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
                    <Select
                        id="category"
                        label="Category"
                        options={CATEGORIES}
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                    />
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
