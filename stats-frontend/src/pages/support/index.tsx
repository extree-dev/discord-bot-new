import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { TextArea } from '../../shared/ui/TextArea';
import { Button } from '../../shared/ui/Button';
import { submitSupportTicket, getAccount, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

// Доступна и без входа (см. обсуждение) — залогиненному пользователю email
// берём из аккаунта и не даём редактировать (бэкенд игнорировал бы
// присланный, но меньше путаницы показать это явно), без сессии просят
// ввести email в форме.
export function SupportPage() {
    const [accountEmail, setAccountEmail] = useState<string | null>(null);
    const [checkingAccount, setCheckingAccount] = useState(true);
    const [email, setEmail] = useState('');
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
            const result = await submitSupportTicket(subject, message, accountEmail ? undefined : email);
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
