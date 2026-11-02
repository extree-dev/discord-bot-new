import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { TextArea } from '../../shared/ui/TextArea';
import { Select } from '../../shared/ui/Select';
import { Button } from '../../shared/ui/Button';
import { ErrorBanner } from '../../shared/ui/ErrorBanner';
import { submitSupportTicket, getAccount, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const CATEGORIES = [
    { value: 'account', label: 'Account & login' },
    { value: 'bug', label: 'Bug report' },
    { value: 'billing', label: 'Billing' },
    { value: 'other', label: 'Other' },
];

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
        getAccount().then(({ user }) => {
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
            sideTitle={
                <>
                    We're here
                    <br />
                    <span className="hl">to help.</span>
                </>
            }
            badge="Support"
            heading="Contact support"
            lead="Found a bug, have a question about your account, or something not working right? Send us a message — we read every one."
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
                    {error && <ErrorBanner>{error}</ErrorBanner>}

                    {!checkingAccount && accountEmail && (
                        <div className={styles.accountEmail}>
                            We&apos;ll use your account email: <strong>{accountEmail}</strong>
                        </div>
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
