import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { forgotPassword, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [sent, setSent] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            await forgotPassword(email);
            // Один и тот же ответ независимо от того, существует ли
            // аккаунт — сервер нарочно не сообщает (см. server.js), и
            // UI показывает один и тот же текст, а не угадывает.
            setSent(true);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    return (
        <SplitAuthLayout
            badge="Forgot your password?"
            heading={
                <>
                    Reset your
                    <br />
                    <span className="hl">password.</span>
                </>
            }
            lead="Enter the email on your account and we'll send you a link to set a new password."
            cardTitle="Reset password"
            error={error}
            footer={
                <>
                    Remembered it? <Link to="/login">Log in</Link>
                </>
            }
        >
            {sent ? (
                <p className={styles.sent}>
                    If <strong>{email}</strong> is registered with us, you&apos;ll get a reset link shortly. Check your
                    inbox (and spam folder).
                </p>
            ) : (
                <form className={styles.form} onSubmit={onSubmit}>
                    <TextField
                        id="email"
                        label="Email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    <Button type="submit" variant="flat" fullWidth disabled={pending}>
                        {pending ? 'Sending…' : 'Send reset link'}
                    </Button>
                </form>
            )}
        </SplitAuthLayout>
    );
}
